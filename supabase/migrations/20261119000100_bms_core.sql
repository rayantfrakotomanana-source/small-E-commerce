create extension if not exists pgcrypto;

create table public.bms_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bms_products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.bms_categories(id),
  name text not null,
  sku text unique,
  description text not null default '',
  purchase_price integer not null default 0 check (purchase_price >= 0),
  selling_price integer not null default 0 check (selling_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  image_url text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bms_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bms_sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  customer_id uuid references public.bms_customers(id),
  subtotal integer not null check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  total integer not null check (total >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('paid','partial','unpaid','cancelled')),
  status text not null default 'completed' check (status in ('completed','cancelled','returned')),
  note text,
  sold_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create table public.bms_sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.bms_sales(id) on delete restrict,
  product_id uuid references public.bms_products(id) on delete restrict,
  product_name text not null,
  purchase_price integer not null check (purchase_price >= 0),
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total integer not null check (line_total >= 0)
);

create table public.bms_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.bms_sales(id) on delete restrict,
  amount integer not null check (amount >= 0),
  method text not null check (method in ('cash','mobile_money','bank_transfer','other')),
  reference text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.bms_expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bms_expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.bms_expense_categories(id),
  description text not null,
  amount integer not null check (amount >= 0),
  method text not null check (method in ('cash','mobile_money','bank_transfer','other')),
  expense_date date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bms_stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.bms_products(id) on delete restrict,
  movement_type text not null check (movement_type in ('purchase','sale','return','adjustment','sale_cancellation')),
  quantity_change integer not null,
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bms_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in ('opening_balance','sale_payment','expense','adjustment','closing_count')),
  amount integer not null,
  description text,
  transaction_date date not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bms_cash_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  opening_balance integer not null check (opening_balance >= 0),
  expected_closing integer not null,
  physically_counted integer,
  discrepancy integer,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.bms_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index bms_products_category_idx on public.bms_products(category_id) where archived_at is null;
create index bms_products_stock_idx on public.bms_products(stock_quantity);
create index bms_sales_sold_at_idx on public.bms_sales(sold_at desc);
create index bms_sales_customer_idx on public.bms_sales(customer_id);
create index bms_sale_items_sale_idx on public.bms_sale_items(sale_id);
create index bms_payments_sale_idx on public.bms_payments(sale_id);
create index bms_expenses_date_idx on public.bms_expenses(expense_date desc);
create index bms_stock_product_idx on public.bms_stock_movements(product_id, created_at desc);
create index bms_cash_date_idx on public.bms_cash_transactions(transaction_date desc);

insert into public.bms_categories(name, sort_order) values ('General', 1), ('Electronics', 2), ('Accessories', 3) on conflict do nothing;
insert into public.bms_expense_categories(name) values ('Transport'), ('Electricity'), ('Internet'), ('Rent'), ('Supplies'), ('Maintenance'), ('Business purchases'), ('Other') on conflict do nothing;
insert into public.bms_settings(key, value) values ('currency', '"MGA"'::jsonb), ('shop_name', '"JR Concept"'::jsonb), ('cash_opening_balance', '0'::jsonb) on conflict do nothing;

alter table public.bms_categories enable row level security;
alter table public.bms_products enable row level security;
alter table public.bms_customers enable row level security;
alter table public.bms_sales enable row level security;
alter table public.bms_sale_items enable row level security;
alter table public.bms_payments enable row level security;
alter table public.bms_expense_categories enable row level security;
alter table public.bms_expenses enable row level security;
alter table public.bms_stock_movements enable row level security;
alter table public.bms_cash_transactions enable row level security;
alter table public.bms_cash_snapshots enable row level security;
alter table public.bms_settings enable row level security;

create or replace function public.bms_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active and role = 'superadmin'
  );
$$;

-- Owner-only table access. Public and employee roles lose access to BMS records.
do $$
declare
  table_name text;
begin
  for table_name in
    select unnest(array[
      'bms_categories','bms_products','bms_customers','bms_sales','bms_sale_items',
      'bms_payments','bms_expense_categories','bms_expenses','bms_stock_movements',
      'bms_cash_transactions','bms_cash_snapshots','bms_settings'
    ])
  loop
    execute format('grant all on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('create policy %I_owner_all on public.%I for all to authenticated using (public.bms_is_owner()) with check (public.bms_is_owner())', table_name || '_owner', table_name);
  end loop;
end;
$$;

create or replace function public.bms_create_sale(
  p_customer_id uuid,
  p_discount integer,
  p_items jsonb,
  p_payments jsonb,
  p_note text default null,
  p_sold_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_id uuid := gen_random_uuid();
  item jsonb;
  product_row public.bms_products%rowtype;
  payment jsonb;
  subtotal integer := 0;
  total_paid integer := 0;
  sale_total integer;
  sequence_number integer;
  paid_status text;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  if p_discount < 0 then raise exception 'Discount cannot be negative'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Sale must contain at least one item'; end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    if (item->>'quantity')::integer <= 0 then raise exception 'Quantity must be positive'; end if;
    select * into product_row from public.bms_products
      where id = (item->>'product_id')::uuid and archived_at is null for update;
    if not found then raise exception 'Active product not found'; end if;
    if product_row.stock_quantity < (item->>'quantity')::integer then raise exception 'Insufficient stock for %', product_row.name; end if;
    subtotal := subtotal + product_row.selling_price * (item->>'quantity')::integer;
  end loop;

  sale_total := greatest(subtotal - p_discount, 0);
  insert into public.bms_sales(id, sale_number, customer_id, subtotal, discount, total, payment_status, status, note, sold_at, created_by)
  values (sale_id, 'SALE-' || to_char(p_sold_at, 'YYYYMMDD') || '-' || upper(substr(replace(sale_id::text, '-', ''), 1, 8)),
          p_customer_id, subtotal, p_discount, sale_total, 'unpaid', 'completed', nullif(btrim(p_note), ''), p_sold_at, auth.uid());

  for item in select * from jsonb_array_elements(p_items)
  loop
    select * into product_row from public.bms_products where id = (item->>'product_id')::uuid for update;
    insert into public.bms_sale_items(sale_id, product_id, product_name, purchase_price, unit_price, quantity, line_total)
    values (sale_id, product_row.id, product_row.name, product_row.purchase_price, product_row.selling_price,
            (item->>'quantity')::integer, product_row.selling_price * (item->>'quantity')::integer);
    insert into public.bms_stock_movements(product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
    values (product_row.id, 'sale', -(item->>'quantity')::integer, product_row.stock_quantity,
            product_row.stock_quantity - (item->>'quantity')::integer, 'sale', sale_id, 'Sale stock deduction', auth.uid());
    update public.bms_products set stock_quantity = stock_quantity - (item->>'quantity')::integer,
      updated_at = now() where id = product_row.id;
  end loop;

  if jsonb_typeof(p_payments) <> 'array' then raise exception 'Payments must be an array'; end if;
  for payment in select * from jsonb_array_elements(p_payments)
  loop
    if (payment->>'amount')::integer < 0 then raise exception 'Payment amount cannot be negative'; end if;
    insert into public.bms_payments(sale_id, amount, method, reference, paid_at)
    values (sale_id, (payment->>'amount')::integer,
      (payment->>'method')::text,
      nullif(payment->>'reference', ''), coalesce((payment->>'paid_at')::timestamptz, p_sold_at));
    total_paid := total_paid + (payment->>'amount')::integer;
    if (payment->>'method')::text = 'cash' and (payment->>'amount')::integer > 0 then
      insert into public.bms_cash_transactions(transaction_type, amount, description, transaction_date, created_by)
      values ('sale_payment', (payment->>'amount')::integer, 'Cash received from sale', p_sold_at::date, auth.uid());
    end if;
  end loop;

  paid_status := case when total_paid >= sale_total then 'paid' when total_paid > 0 then 'partial' else 'unpaid' end;
  update public.bms_sales set payment_status = paid_status where id = sale_id;
  return sale_id;
end;
$$;

create or replace function public.bms_cancel_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_row public.bms_sales%rowtype;
  item_row public.bms_sale_items%rowtype;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  select * into sale_row from public.bms_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale_row.status <> 'completed' then raise exception 'Sale cannot be cancelled'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Cancellation reason is required'; end if;

  for item_row in select * from public.bms_sale_items where sale_id = p_sale_id
  loop
    if item_row.product_id is not null then
      declare product_row public.bms_products%rowtype;
      begin
        select * into product_row from public.bms_products where id = item_row.product_id for update;
        insert into public.bms_stock_movements(product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
        values (product_row.id, 'sale_cancellation', item_row.quantity, product_row.stock_quantity,
                product_row.stock_quantity + item_row.quantity, 'sale', p_sale_id, 'Sale cancellation stock restoration', auth.uid());
        update public.bms_products set stock_quantity = stock_quantity + item_row.quantity,
          updated_at = now() where id = product_row.id;
      end;
    end if;
  end loop;

  update public.bms_sales set status = 'cancelled', payment_status = 'cancelled', cancelled_at = now(), cancellation_reason = btrim(p_reason) where id = p_sale_id;
end;
$$;

create or replace function public.bms_adjust_stock(p_product_id uuid, p_quantity_change integer, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.bms_products%rowtype;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  if p_quantity_change = 0 then raise exception 'Adjustment cannot be zero'; end if;
  if nullif(btrim(p_note), '') is null then raise exception 'Adjustment note is required'; end if;
  select * into product_row from public.bms_products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if product_row.stock_quantity + p_quantity_change < 0 then raise exception 'Adjustment would create negative stock'; end if;
  insert into public.bms_stock_movements(product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
  values (p_product_id, 'adjustment', p_quantity_change, product_row.stock_quantity,
          product_row.stock_quantity + p_quantity_change, 'adjustment', null, btrim(p_note), auth.uid());
  update public.bms_products set stock_quantity = stock_quantity + p_quantity_change, updated_at = now() where id = p_product_id;
end;
$$;

create or replace function public.bms_record_expense(p_category_id uuid, p_description text, p_amount integer, p_method text, p_expense_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expense_id uuid := gen_random_uuid();
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  if p_amount < 0 then raise exception 'Expense amount cannot be negative'; end if;
  if nullif(btrim(p_description), '') is null then raise exception 'Description is required'; end if;
  if p_method not in ('cash','mobile_money','bank_transfer','other') then raise exception 'Invalid payment method'; end if;
  insert into public.bms_expenses(id, category_id, description, amount, method, expense_date, created_by)
  values (expense_id, p_category_id, btrim(p_description), p_amount, p_method, p_expense_date, auth.uid());
  if p_method = 'cash' then
    insert into public.bms_cash_transactions(transaction_type, amount, description, transaction_date, created_by)
    values ('expense', -p_amount, btrim(p_description), p_expense_date, auth.uid());
  end if;
  return expense_id;
end;
$$;

revoke all on function public.bms_create_sale(uuid, integer, jsonb, jsonb, text, timestamptz) from public, anon;
revoke all on function public.bms_cancel_sale(uuid, text) from public, anon;
revoke all on function public.bms_adjust_stock(uuid, integer, text) from public, anon;
revoke all on function public.bms_record_expense(uuid, text, integer, text, date) from public, anon;
grant execute on function public.bms_create_sale(uuid, integer, jsonb, jsonb, text, timestamptz) to authenticated;
grant execute on function public.bms_cancel_sale(uuid, text) to authenticated;
grant execute on function public.bms_adjust_stock(uuid, integer, text) to authenticated;
grant execute on function public.bms_record_expense(uuid, text, integer, text, date) to authenticated;
