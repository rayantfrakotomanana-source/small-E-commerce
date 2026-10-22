create or replace function public.create_manual_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  manual_payload jsonb;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to create manual orders';
  end if;
  if coalesce(payload->>'source', '') not in ('facebook', 'whatsapp', 'appel') then
    raise exception 'Invalid manual order source';
  end if;
  manual_payload := payload || jsonb_build_object('ip_hash', null);
  new_order_id := public.create_order(manual_payload);

  if coalesce((payload->>'payment_status') = 'paye', false) then
    perform public.mark_paid(new_order_id, nullif(payload->>'payment_ref', ''));
  end if;
  if nullif(payload->>'livreur_id', '') is not null then
    perform public.confirm_order(new_order_id);
    perform public.assign_livreur(new_order_id, (payload->>'livreur_id')::uuid);
  end if;
  return new_order_id;
end;
$$;

create or replace function public.set_order_transport(
  target_order_id uuid, info text, location_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to update transport information';
  end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not order_row.is_province or order_row.status <> 'en_cours' then
    raise exception 'Transport details are only available for in-progress province orders';
  end if;
  if nullif(btrim(info), '') is null then raise exception 'Transport information is required'; end if;
  if location_url is not null and location_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Transport URL must use HTTPS';
  end if;
  update public.orders set transport_info = btrim(info), transport_url = nullif(btrim(location_url), '')
  where id = target_order_id;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
  values (target_order_id, auth.uid(), 'transport_info', order_row.transport_info, btrim(info), nullif(btrim(location_url), ''));
end;
$$;

create or replace function public.admin_mark_delivered(target_order_id uuid, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to mark orders delivered';
  end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not order_row.is_province or order_row.status <> 'en_cours' or order_row.livreur_id is not null then
    raise exception 'Only unassigned in-progress province orders can be marked delivered manually';
  end if;
  update public.orders set status = 'livree', delivered_at = now() where id = target_order_id;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
  values (target_order_id, auth.uid(), 'status', 'en_cours', 'livree', nullif(btrim(note), ''));
end;
$$;

create or replace function public.close_livreur_cash(
  closing_day date, target_livreur_id uuid, received integer, closing_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected integer;
  closing_id uuid;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to close cash';
  end if;
  if received < 0 then raise exception 'Received cash cannot be negative'; end if;
  if not exists (select 1 from public.profiles where id = target_livreur_id and role = 'livreur') then
    raise exception 'Livreur not found';
  end if;
  select coalesce(sum(coalesce(o.cash_collected_ar, o.total)), 0)::integer into expected
  from public.orders o
  where o.livreur_id = target_livreur_id
    and o.status = 'livree'
    and o.payment_mode = 'cash'
    and o.delivered_at::date = closing_day
    and not o.cash_handed_over;
  insert into public.cash_closings(day, livreur_id, expected_ar, received_ar, note, created_by)
  values (closing_day, target_livreur_id, expected, received, nullif(btrim(closing_note), ''), auth.uid())
  on conflict (day, livreur_id) do update set
    expected_ar = public.cash_closings.expected_ar,
    received_ar = excluded.received_ar,
    note = excluded.note,
    created_by = excluded.created_by
  returning id into closing_id;
  update public.orders set cash_handed_over = true
  where livreur_id = target_livreur_id and status = 'livree' and payment_mode = 'cash'
    and delivered_at::date = closing_day and not cash_handed_over;
  return closing_id;
end;
$$;

revoke all on function public.create_manual_order(jsonb) from public, anon;
revoke all on function public.set_order_transport(uuid, text, text) from public, anon;
revoke all on function public.admin_mark_delivered(uuid, text) from public, anon;
revoke all on function public.close_livreur_cash(date, uuid, integer, text) from public, anon;
grant execute on function public.create_manual_order(jsonb) to authenticated;
grant execute on function public.set_order_transport(uuid, text, text) to authenticated;
grant execute on function public.admin_mark_delivered(uuid, text) to authenticated;
grant execute on function public.close_livreur_cash(date, uuid, integer, text) to authenticated;
grant execute on function public.create_manual_order(jsonb) to service_role;
grant execute on function public.set_order_transport(uuid, text, text) to service_role;
grant execute on function public.admin_mark_delivered(uuid, text) to service_role;
grant execute on function public.close_livreur_cash(date, uuid, integer, text) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
      ) then
    execute 'alter publication supabase_realtime add table public.orders';
  end if;
end;
$$;