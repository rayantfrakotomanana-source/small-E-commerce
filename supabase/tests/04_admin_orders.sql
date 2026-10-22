begin;

insert into auth.users(id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000301', 'authenticated', 'authenticated', 'orders-admin@example.invalid', '{"full_name":"Order Admin"}'),
  ('00000000-0000-4000-8000-000000000302', 'authenticated', 'authenticated', 'orders-courier@example.invalid', '{"full_name":"Order Courier"}')
on conflict (id) do nothing;

update public.profiles set role = 'admin', active = true where id = '00000000-0000-4000-8000-000000000301';
update public.profiles set role = 'livreur', active = true where id = '00000000-0000-4000-8000-000000000302';

insert into public.products(id, category_id, name_fr, name_mg, price_ar, stock)
select '00000000-0000-4000-8000-000000000303', id, 'Order Test Product', 'Order Test Product', 10000, 20
from public.categories where slug = 'tech';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);

do $$
declare
  unpaid_order uuid;
  province_order uuid;
  cash_order uuid;
  closing_id uuid;
  order_status public.order_status;
  closing_expected integer;
  closing_difference integer;
  payload jsonb;
begin
  payload := jsonb_build_object(
    'customer_name', 'Manual Facebook Customer', 'phone', '0347654301',
    'address', 'Antananarivo', 'source', 'facebook', 'payment_mode', 'mvola',
    'payment_status', 'non_paye', 'payer_name', 'Declared Payer',
    'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8000-000000000303', 'qty', 1))
  );
  unpaid_order := public.create_manual_order(payload);
  begin
    perform public.confirm_order(unpaid_order);
    raise exception 'ASSERTION FAILED: unpaid manual mobile-money order was confirmed';
  exception when others then
    if sqlerrm <> 'Payment must be confirmed before preparation' then raise; end if;
  end;
  perform public.mark_paid(unpaid_order, 'SMS-REFERENCE-1');
  perform public.confirm_order(unpaid_order);
  perform public.assign_livreur(unpaid_order, '00000000-0000-4000-8000-000000000302');
  select status into order_status from public.orders where id = unpaid_order;
  if order_status <> 'en_cours' then raise exception 'ASSERTION FAILED: manual order did not enter progress'; end if;

  province_order := public.create_manual_order(jsonb_build_object(
    'customer_name', 'Province Customer', 'phone', '0347654302', 'address', 'Toamasina',
    'city', 'Toamasina', 'is_province', true, 'source', 'whatsapp', 'payment_mode', 'orange',
    'payment_status', 'paye', 'payer_name', 'Province Payer',
    'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8000-000000000303', 'qty', 1))
  ));
  perform public.confirm_order(province_order);
  perform public.set_order_transport(province_order, 'Bus Cotisse, gare routière, départ 18h', 'https://maps.example.invalid/station');
  perform public.admin_mark_delivered(province_order, 'Customer confirmed receipt');
  select status into order_status from public.orders where id = province_order;
  if order_status <> 'livree' then raise exception 'ASSERTION FAILED: province order was not marked delivered'; end if;

  cash_order := public.create_manual_order(jsonb_build_object(
    'customer_name', 'Cash Customer', 'phone', '0347654303', 'address', 'Antananarivo',
    'source', 'appel', 'payment_mode', 'cash', 'payment_status', 'non_paye',
    'livreur_id', '00000000-0000-4000-8000-000000000302',
    'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8000-000000000303', 'qty', 1))
  ));
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000302', true);
  perform public.livreur_set_outcome(cash_order, 'livree', null, 15000);
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000301', true);
  closing_id := public.close_livreur_cash(current_date, '00000000-0000-4000-8000-000000000302', 14000, 'Test closing');
  select expected_ar, difference_ar into closing_expected, closing_difference
  from public.cash_closings where id = closing_id;
  if closing_expected <> 15000 or closing_difference <> -1000 then
    raise exception 'ASSERTION FAILED: cash closing expected %, difference %', closing_expected, closing_difference;
  end if;
end;
$$;

rollback;
