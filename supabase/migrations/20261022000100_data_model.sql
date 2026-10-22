create extension if not exists pgcrypto;

create type public.user_role as enum ('superadmin', 'admin', 'livreur');
create type public.order_status as enum ('a_confirmer', 'en_cours', 'livree', 'annulee');
create type public.payment_status as enum ('non_paye', 'paye');
create type public.payment_mode as enum ('cash', 'mvola', 'orange');
create type public.order_source as enum ('app', 'facebook', 'whatsapp', 'appel');
create type public.category_kind as enum ('tech', 'divers');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.user_role not null default 'admin',
  active boolean not null default true
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  name_mg text not null,
  kind public.category_kind not null,
  sort integer not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name_fr text not null,
  name_mg text not null,
  desc_fr text not null default '',
  desc_mg text not null default '',
  price_ar integer not null check (price_ar >= 0),
  stock integer not null default 0 check (stock >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= stock),
  images text[] not null default '{}',
  warranty_months integer not null default 0 check (warranty_months >= 0),
  is_sold_out boolean not null default false,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  public_token text not null unique,
  source public.order_source not null default 'app',
  customer_name text not null,
  phone text not null,
  phone2 text,
  address text not null,
  landmark text,
  note text,
  is_province boolean not null default false,
  city text,
  transport_info text,
  transport_url text,
  items_total integer not null check (items_total >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  total integer generated always as (items_total + delivery_fee) stored,
  status public.order_status not null default 'a_confirmer',
  payment_status public.payment_status not null default 'non_paye',
  payment_mode public.payment_mode not null,
  payer_name text,
  payer_phone text,
  payment_ref text,
  livreur_id uuid references public.profiles(id),
  cash_collected_ar integer check (cash_collected_ar is null or cash_collected_ar >= 0),
  cash_handed_over boolean not null default false,
  cancel_reason text,
  is_spam boolean not null default false,
  ip_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  constraint orders_mobile_payer_name check (
    payment_mode = 'cash' or nullif(btrim(payer_name), '') is not null
  )
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  product_id uuid not null references public.products(id),
  name_snapshot text not null,
  unit_price integer not null check (unit_price >= 0),
  qty integer not null check (qty > 0),
  image_snapshot text
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  actor_id uuid references public.profiles(id),
  event text not null,
  from_value text,
  to_value text,
  note text,
  created_at timestamptz not null default now()
);

create table public.blocked_phones (
  phone text primary key,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  livreur_id uuid not null references public.profiles(id),
  expected_ar integer not null,
  received_ar integer not null,
  difference_ar integer generated always as (received_ar - expected_ar) stored,
  note text,
  created_by uuid references public.profiles(id),
  unique (day, livreur_id)
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

create table public.order_number_years (
  year integer primary key,
  last_number integer not null check (last_number > 0)
);

create index orders_status_created_at_idx on public.orders(status, created_at);
create index orders_livreur_id_idx on public.orders(livreur_id);
create index orders_phone_created_at_idx on public.orders(phone, created_at);
create index order_items_order_id_idx on public.order_items(order_id);
create index order_events_order_id_created_at_idx on public.order_events(order_id, created_at);
create index products_category_active_idx on public.products(category_id, is_active) where deleted_at is null;

create or replace function public.caller_has_role(allowed_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = any (allowed_roles)
  );
$$;

create or replace function public.next_order_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_year integer := extract(year from now())::integer;
  sequence_number integer;
begin
  insert into public.order_number_years(year, last_number)
  values (current_year, 1)
  on conflict (year) do update
    set last_number = public.order_number_years.last_number + 1
  returning last_number into sequence_number;
  return format('JR-%s-%s', current_year, lpad(sequence_number::text, 4, '0'));
end;
$$;

create or replace function public.create_order(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid := gen_random_uuid();
  item jsonb;
  product_row public.products%rowtype;
  requested_qty integer;
  computed_total integer := 0;
  items_sum integer;
  fee integer;
  customer_phone text := payload->>'phone';
  requested_source public.order_source := coalesce(payload->>'source', 'app')::public.order_source;
begin
  if auth.uid() is not null and not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to create orders';
  end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'Order must contain at least one item';
  end if;
  if customer_phone is null or customer_phone !~ '^03[23478][0-9]{7}$' then
    raise exception 'Invalid phone number';
  end if;
  if requested_source = 'app' then
    if nullif(payload->>'ip_hash', '') is null then
      raise exception 'IP hash is required';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(customer_phone, 0));
  end if;
  if exists (select 1 from public.blocked_phones where phone = customer_phone) then
    raise exception 'Phone number is blocked';
  end if;
  if requested_source = 'app' and (select count(*) from public.orders
      where phone = customer_phone and created_at >= now() - interval '24 hours') >= 3 then
    raise exception 'Order limit reached for this phone';
  end if;
  if requested_source = 'app' then
    perform pg_advisory_xact_lock(hashtextextended(payload->>'ip_hash', 0));
    if (select count(*) from public.orders where ip_hash = payload->>'ip_hash'
        and created_at >= now() - interval '24 hours') >= 3 then
      raise exception 'Order limit reached for this IP';
    end if;
  end if;

  if requested_source <> 'app' and not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Manual order source requires admin';
  end if;

  for item in
    select jsonb_build_object('product_id', grouped.product_id, 'qty', grouped.qty)
    from (
      select (entry->>'product_id')::uuid as product_id, sum((entry->>'qty')::integer)::integer as qty
      from jsonb_array_elements(payload->'items') entry
      group by (entry->>'product_id')::uuid
      order by (entry->>'product_id')::uuid
    ) grouped
  loop
    requested_qty := (item->>'qty')::integer;
    if requested_qty <= 0 then
      raise exception 'Item quantity must be positive';
    end if;
    select * into product_row from public.products
    where id = (item->>'product_id')::uuid and is_active and deleted_at is null
    for update;
    if not found or product_row.stock - product_row.reserved < requested_qty then
      raise exception 'Insufficient stock for product %', item->>'product_id';
    end if;
    update public.products set reserved = reserved + requested_qty where id = product_row.id;
    computed_total := computed_total + product_row.price_ar * requested_qty;
  end loop;

  select coalesce(sum((entry->>'qty')::integer), 0) into requested_qty
  from jsonb_array_elements(payload->'items') entry;
  if requested_qty <= 0 then raise exception 'Invalid item quantity'; end if;
  items_sum := computed_total;
  select (value #>> '{}')::integer into fee from public.settings where key = 'delivery_fee_ar';
  fee := coalesce(fee, 5000);
  if fee < 0 then raise exception 'Invalid delivery fee setting'; end if;
  if coalesce((payload->>'is_province')::boolean, false)
      and (payload->>'payment_mode')::public.payment_mode = 'cash' then
    raise exception 'Cash payment is only available in Antananarivo';
  end if;
  if nullif(btrim(payload->>'customer_name'), '') is null
      or nullif(btrim(payload->>'address'), '') is null then
    raise exception 'Customer name and address are required';
  end if;

  insert into public.orders (
    id, order_number, public_token, source, customer_name, phone, phone2, address,
    landmark, note, is_province, city, items_total, delivery_fee, payment_mode,
    payer_name, payer_phone, ip_hash, created_by
  ) values (
    new_order_id, public.next_order_number(), gen_random_uuid()::text, requested_source,
    nullif(btrim(payload->>'customer_name'), ''), customer_phone,
    nullif(payload->>'phone2', ''), nullif(btrim(payload->>'address'), ''),
    nullif(payload->>'landmark', ''), nullif(payload->>'note', ''),
    coalesce((payload->>'is_province')::boolean, false), nullif(payload->>'city', ''),
    items_sum, fee, (payload->>'payment_mode')::public.payment_mode,
    nullif(btrim(payload->>'payer_name'), ''), nullif(payload->>'payer_phone', ''),
    nullif(payload->>'ip_hash', ''), auth.uid()
  );

  for item in
    select jsonb_build_object('product_id', grouped.product_id, 'qty', grouped.qty)
    from (
      select (entry->>'product_id')::uuid as product_id, sum((entry->>'qty')::integer)::integer as qty
      from jsonb_array_elements(payload->'items') entry
      group by (entry->>'product_id')::uuid
      order by (entry->>'product_id')::uuid
    ) grouped
  loop
    select * into product_row from public.products where id = (item->>'product_id')::uuid;
    insert into public.order_items(order_id, product_id, name_snapshot, unit_price, qty, image_snapshot)
    values (new_order_id, product_row.id, product_row.name_fr, product_row.price_ar,
      (item->>'qty')::integer, product_row.images[1]);
  end loop;

  insert into public.order_events(order_id, actor_id, event, to_value)
  values (new_order_id, auth.uid(), 'created', 'a_confirmer');
  return new_order_id;
end;
$$;

create or replace function public.mark_paid(target_order_id uuid, ref text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status public.payment_status;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to mark orders paid';
  end if;
  select payment_status into old_status from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if old_status = 'paye' then raise exception 'Order is already paid'; end if;
  update public.orders set payment_status = 'paye', paid_at = now(), payment_ref = nullif(ref, '')
  where id = target_order_id;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
  values (target_order_id, auth.uid(), 'payment_status', old_status::text, 'paye', nullif(ref, ''));
end;
$$;

create or replace function public.confirm_order(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  item_row record;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to confirm orders';
  end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_row.status <> 'a_confirmer' then raise exception 'Order is not awaiting confirmation'; end if;
  if order_row.payment_status <> 'paye' and not (order_row.payment_mode = 'cash' and not order_row.is_province) then
    raise exception 'Payment must be confirmed before preparation';
  end if;
  for item_row in select product_id, qty from public.order_items where order_id = target_order_id order by product_id loop
    update public.products set stock = stock - item_row.qty, reserved = reserved - item_row.qty
    where id = item_row.product_id and stock >= item_row.qty and reserved >= item_row.qty;
    if not found then raise exception 'Reserved stock invariant failed for product %', item_row.product_id; end if;
  end loop;
  update public.orders set status = 'en_cours', confirmed_at = now() where id = target_order_id;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value)
  values (target_order_id, auth.uid(), 'status', 'a_confirmer', 'en_cours');
end;
$$;

create or replace function public.assign_livreur(target_order_id uuid, target_livreur_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_livreur uuid;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to assign orders';
  end if;
  if not exists (select 1 from public.profiles where id = target_livreur_id and active and role = 'livreur') then
    raise exception 'Active livreur not found';
  end if;
  select livreur_id into old_livreur from public.orders
  where id = target_order_id and status = 'en_cours' for update;
  if not found then raise exception 'Order is not in progress'; end if;
  update public.orders set livreur_id = target_livreur_id where id = target_order_id;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value)
  values (target_order_id, auth.uid(), 'livreur_id', old_livreur::text, target_livreur_id::text);
end;
$$;

create or replace function public.cancel_order(target_order_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  item_row record;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to cancel orders';
  end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_row.status in ('livree', 'annulee') then raise exception 'Order cannot be cancelled'; end if;
  for item_row in select product_id, qty from public.order_items where order_id = target_order_id order by product_id loop
    if order_row.status = 'a_confirmer' then
      update public.products set reserved = reserved - item_row.qty
      where id = item_row.product_id and reserved >= item_row.qty;
    else
      update public.products set stock = stock + item_row.qty
      where id = item_row.product_id;
    end if;
    if not found then raise exception 'Stock invariant failed for product %', item_row.product_id; end if;
  end loop;
  update public.orders set status = 'annulee', cancel_reason = nullif(btrim(reason), '')
  where id = target_order_id;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
  values (target_order_id, auth.uid(), 'status', order_row.status::text, 'annulee', nullif(btrim(reason), ''));
end;
$$;

create or replace function public.reject_spam(target_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
begin
  if not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to reject spam';
  end if;
  select * into order_row from public.orders where id = target_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_row.status not in ('a_confirmer', 'en_cours') then raise exception 'Order cannot be rejected as spam'; end if;
  perform public.cancel_order(target_order_id, 'spam');
  update public.orders set is_spam = true where id = target_order_id;
  insert into public.blocked_phones(phone, reason) values (order_row.phone, 'spam')
  on conflict (phone) do update set reason = excluded.reason;
  insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
  values (target_order_id, auth.uid(), 'is_spam', 'false', 'true', 'spam');
end;
$$;

create or replace function public.livreur_set_outcome(
  target_order_id uuid, outcome text, reason text default null, cash_collected integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  item_row record;
begin
  if not public.caller_has_role(array['livreur']::public.user_role[]) then
    raise exception 'Not authorized as livreur';
  end if;
  select * into order_row from public.orders
  where id = target_order_id and livreur_id = auth.uid() and status = 'en_cours' for update;
  if not found then raise exception 'Order is not assigned to this livreur'; end if;
  if outcome = 'livree' then
    if cash_collected is not null and cash_collected < 0 then raise exception 'Invalid cash amount'; end if;
    update public.orders set status = 'livree', payment_status = 'paye',
      cash_collected_ar = cash_collected, delivered_at = now() where id = target_order_id;
    insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
    values (target_order_id, auth.uid(), 'status', 'en_cours', 'livree', nullif(reason, ''));
    insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
    values (target_order_id, auth.uid(), 'payment_status', order_row.payment_status::text, 'paye',
      case when order_row.payment_status = 'paye' then null else 'cash collected' end);
  elsif outcome in ('injoignable', 'reporté') then
    insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
    values (target_order_id, auth.uid(), outcome, 'en_cours', 'en_cours', nullif(btrim(reason), ''));
  elsif outcome = 'refusé' then
    for item_row in select product_id, qty from public.order_items where order_id = target_order_id order by product_id loop
      update public.products set stock = stock + item_row.qty where id = item_row.product_id;
    end loop;
    update public.orders set status = 'annulee', cancel_reason = nullif(btrim(reason), '') where id = target_order_id;
    insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
    values (target_order_id, auth.uid(), 'status', 'en_cours', 'annulee', nullif(btrim(reason), ''));
  else
    raise exception 'Unsupported outcome';
  end if;
end;
$$;

create or replace function public.expire_unconfirmed_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_hours integer;
  order_row public.orders%rowtype;
  item_row record;
  expired_count integer := 0;
begin
  if auth.uid() is not null and not public.caller_has_role(array['superadmin', 'admin']::public.user_role[]) then
    raise exception 'Not authorized to expire orders';
  end if;
  if auth.uid() is null and session_user <> 'postgres' then
    raise exception 'Not authorized to expire orders';
  end if;
  select coalesce((value #>> '{}')::integer, 24) into reservation_hours
  from public.settings where key = 'reservation_hours';
  reservation_hours := coalesce(reservation_hours, 24);
  if reservation_hours < 1 then raise exception 'Invalid reservation hours setting'; end if;
  for order_row in
    select * from public.orders where status = 'a_confirmer'
      and created_at < now() - make_interval(hours => reservation_hours) for update skip locked
  loop
    for item_row in select product_id, qty from public.order_items where order_id = order_row.id order by product_id loop
      update public.products set reserved = reserved - item_row.qty
      where id = item_row.product_id and reserved >= item_row.qty;
      if not found then raise exception 'Reservation invariant failed for product %', item_row.product_id; end if;
    end loop;
    update public.orders set status = 'annulee', cancel_reason = 'expiré' where id = order_row.id;
    insert into public.order_events(order_id, actor_id, event, from_value, to_value, note)
    values (order_row.id, auth.uid(), 'status', 'a_confirmer', 'annulee', 'expiré');
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on function public.caller_has_role(public.user_role[]) from public;
revoke all on function public.next_order_number() from public;
revoke all on function public.create_order(jsonb) from public;
revoke all on function public.mark_paid(uuid, text) from public;
revoke all on function public.confirm_order(uuid) from public;
revoke all on function public.assign_livreur(uuid, uuid) from public;
revoke all on function public.cancel_order(uuid, text) from public;
revoke all on function public.reject_spam(uuid) from public;
revoke all on function public.livreur_set_outcome(uuid, text, text, integer) from public;
revoke all on function public.expire_unconfirmed_orders() from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
grant execute on function public.mark_paid(uuid, text) to authenticated;
grant execute on function public.confirm_order(uuid) to authenticated;
grant execute on function public.assign_livreur(uuid, uuid) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.reject_spam(uuid) to authenticated;
grant execute on function public.livreur_set_outcome(uuid, text, text, integer) to authenticated;
grant execute on function public.expire_unconfirmed_orders() to authenticated;

insert into public.categories(slug, name_fr, name_mg, kind, sort) values
  ('tech', 'Tech', 'Tech', 'tech', 1),
  ('divers', 'Divers', 'Samihafa', 'divers', 2);

insert into public.settings(key, value) values
  ('whatsapp_number', to_jsonb(''::text)),
  ('shop_name', to_jsonb('JR Concept'::text)),
  ('nif', to_jsonb('A_COMPLETER'::text)),
  ('stat', to_jsonb('A_COMPLETER'::text)),
  ('delivery_fee_ar', '5000'::jsonb),
  ('reservation_hours', '24'::jsonb);

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if not exists (select 1 from cron.job where jobname = 'expire-unconfirmed-orders-hourly') then
      perform cron.schedule('expire-unconfirmed-orders-hourly', '0 * * * *',
        'select public.expire_unconfirmed_orders()');
    end if;
  end if;
end;
$$;