alter table public.profiles alter column role set default 'livreur';
alter table public.profiles alter column active set default false;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, phone, role, active)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email, 'Pending staff user'),
    nullif(new.raw_user_meta_data->>'phone', ''),
    'livreur',
    false
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.blocked_phones enable row level security;
alter table public.cash_closings enable row level security;
alter table public.settings enable row level security;
alter table public.order_number_years enable row level security;

revoke all on public.profiles, public.categories, public.products, public.orders,
  public.order_items, public.order_events, public.blocked_phones, public.cash_closings,
  public.settings, public.order_number_years from anon, authenticated;

grant select on public.categories, public.products, public.settings to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.order_events,
  public.blocked_phones, public.cash_closings to authenticated;
grant execute on function public.caller_has_role(public.user_role[]) to anon, authenticated;
revoke execute on function public.create_order(jsonb) from anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.mark_paid(uuid, text) to service_role;
grant execute on function public.confirm_order(uuid) to service_role;
grant execute on function public.assign_livreur(uuid, uuid) to service_role;
grant execute on function public.cancel_order(uuid, text) to service_role;
grant execute on function public.reject_spam(uuid) to service_role;
grant execute on function public.livreur_set_outcome(uuid, text, text, integer) to service_role;
grant execute on function public.expire_unconfirmed_orders() to service_role;

create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (true);

create policy categories_staff_write on public.categories
  for all to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]))
  with check (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy products_public_read on public.products
  for select to anon, authenticated
  using (is_active and deleted_at is null);

create policy products_staff_read on public.products
  for select to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy products_staff_write on public.products
  for all to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]))
  with check (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy profiles_self_or_superadmin_read on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.caller_has_role(array['superadmin']::public.user_role[]));

create policy profiles_superadmin_insert on public.profiles
  for insert to authenticated
  with check (public.caller_has_role(array['superadmin']::public.user_role[]));

create policy profiles_superadmin_update on public.profiles
  for update to authenticated
  using (public.caller_has_role(array['superadmin']::public.user_role[]))
  with check (public.caller_has_role(array['superadmin']::public.user_role[]));

create policy profiles_superadmin_delete on public.profiles
  for delete to authenticated
  using (public.caller_has_role(array['superadmin']::public.user_role[]));

create policy orders_staff_read on public.orders
  for select to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy orders_livreur_assigned_read on public.orders
  for select to authenticated
  using (
    livreur_id = (select auth.uid())
    and public.caller_has_role(array['livreur']::public.user_role[])
  );

create policy order_items_staff_read on public.order_items
  for select to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy order_items_livreur_assigned_read on public.order_items
  for select to authenticated
  using (
    public.caller_has_role(array['livreur']::public.user_role[])
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.livreur_id = (select auth.uid())
    )
  );

create policy order_events_staff_read on public.order_events
  for select to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy blocked_phones_staff_read on public.blocked_phones
  for select to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy cash_closings_staff_read on public.cash_closings
  for select to authenticated
  using (public.caller_has_role(array['superadmin', 'admin']::public.user_role[]));

create policy settings_public_read on public.settings
  for select to anon, authenticated
  using (key in ('whatsapp_number', 'shop_name', 'delivery_fee_ar'));

create policy settings_superadmin_read on public.settings
  for select to authenticated
  using (public.caller_has_role(array['superadmin']::public.user_role[]));

create policy settings_superadmin_write on public.settings
  for all to authenticated
  using (public.caller_has_role(array['superadmin']::public.user_role[]))
  with check (public.caller_has_role(array['superadmin']::public.user_role[]));