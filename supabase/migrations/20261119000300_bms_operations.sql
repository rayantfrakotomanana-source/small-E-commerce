create or replace function public.bms_record_purchase(p_product_id uuid, p_quantity integer, p_unit_cost integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.bms_products%rowtype;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  if p_quantity <= 0 then raise exception 'Purchase quantity must be positive'; end if;
  if p_unit_cost < 0 then raise exception 'Purchase cost cannot be negative'; end if;
  select * into product_row from public.bms_products where id = p_product_id and archived_at is null for update;
  if not found then raise exception 'Active product not found'; end if;
  insert into public.bms_stock_movements(product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
  values (p_product_id, 'purchase', p_quantity, product_row.stock_quantity, product_row.stock_quantity + p_quantity,
          'purchase', null, nullif(btrim(p_note), ''), auth.uid());
  update public.bms_products set stock_quantity = stock_quantity + p_quantity,
    purchase_price = p_unit_cost, updated_at = now() where id = p_product_id;
  return gen_random_uuid();
end;
$$;

create or replace function public.bms_record_payment(p_sale_id uuid, p_amount integer, p_method text, p_reference text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_row public.bms_sales%rowtype;
  payment_id uuid := gen_random_uuid();
  paid_total integer;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  if p_method not in ('cash','mobile_money','bank_transfer','other') then raise exception 'Invalid payment method'; end if;
  select * into sale_row from public.bms_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale_row.status <> 'completed' then raise exception 'Payments only apply to completed sales'; end if;
  select coalesce(sum(amount), 0) into paid_total from public.bms_payments where sale_id = p_sale_id;
  if paid_total + p_amount > sale_row.total then raise exception 'Payment exceeds outstanding balance'; end if;
  insert into public.bms_payments(id, sale_id, amount, method, reference)
  values (payment_id, p_sale_id, p_amount, p_method, nullif(btrim(p_reference), ''));
  paid_total := paid_total + p_amount;
  update public.bms_sales set payment_status = case when paid_total >= total then 'paid' else 'partial' end where id = p_sale_id;
  if p_method = 'cash' then
    insert into public.bms_cash_transactions(transaction_type, amount, description, transaction_date, created_by)
    values ('sale_payment', p_amount, 'Additional sale payment', (now() at time zone 'Indian/Antananarivo')::date, auth.uid());
  end if;
  return payment_id;
end;
$$;

create or replace function public.bms_return_sale(p_sale_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_row public.bms_sales%rowtype;
  item_row public.bms_sale_items%rowtype;
  product_row public.bms_products%rowtype;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  select * into sale_row from public.bms_sales where id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale_row.status <> 'completed' then raise exception 'Only completed sales can be returned'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Return reason is required'; end if;
  for item_row in select * from public.bms_sale_items where sale_id = p_sale_id
  loop
    if item_row.product_id is not null then
      select * into product_row from public.bms_products where id = item_row.product_id for update;
      insert into public.bms_stock_movements(product_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
      values (product_row.id, 'return', item_row.quantity, product_row.stock_quantity, product_row.stock_quantity + item_row.quantity,
              'sale_return', p_sale_id, btrim(p_reason), auth.uid());
      update public.bms_products set stock_quantity = stock_quantity + item_row.quantity, updated_at = now() where id = product_row.id;
    end if;
  end loop;
  update public.bms_sales set status = 'returned', cancellation_reason = btrim(p_reason) where id = p_sale_id;
end;
$$;

create or replace function public.bms_upsert_category(p_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_id uuid;
begin
  if not public.bms_is_owner() then raise exception 'Owner access required'; end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Category name is required'; end if;
  if p_id is null then
    insert into public.bms_categories(name) values (btrim(p_name)) returning id into category_id;
  else
    update public.bms_categories set name=btrim(p_name), archived_at=null where id=p_id returning id into category_id;
  end if;
  return category_id;
end;
$$;

revoke all on function public.bms_record_purchase(uuid, integer, integer, text) from public, anon;
revoke all on function public.bms_record_payment(uuid, integer, text, text) from public, anon;
revoke all on function public.bms_return_sale(uuid, text) from public, anon;
revoke all on function public.bms_upsert_category(uuid, text) from public, anon;
grant execute on function public.bms_record_purchase(uuid, integer, integer, text) to authenticated;
grant execute on function public.bms_record_payment(uuid, integer, text, text) to authenticated;
grant execute on function public.bms_return_sale(uuid, text) to authenticated;
grant execute on function public.bms_upsert_category(uuid, text) to authenticated;
