begin;

insert into auth.users(id, aud, role, email)
values ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'task01-admin@example.invalid')
on conflict (id) do nothing;

insert into public.profiles(id, full_name, role, active)
values ('00000000-0000-4000-8000-000000000001', 'Task 01 Test Admin', 'admin', true)
on conflict (id) do update set role = 'admin', active = true;

insert into public.products(id, category_id, name_fr, name_mg, price_ar, stock)
select '00000000-0000-4000-8000-000000000002', id, 'Task 01 Test Product', 'Task 01 Test Product', 1000, 1
from public.categories where slug = 'tech'
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '', true);

do $$
begin
  begin
    perform public.create_order(jsonb_build_object(
      'customer_name', 'Test Customer', 'phone', '0341234567', 'address', 'Test address',
      'payment_mode', 'mvola', 'payer_name', 'Test Payer', 'ip_hash', 'oversell-test-ip',
      'items', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8000-000000000002', 'qty', 2))
    ));
    raise exception 'ASSERTION FAILED: overselling was accepted';
  exception when others then
    if sqlerrm not like 'Insufficient stock for product%' then raise; end if;
  end;
end;
$$;

update public.products set stock = 10 where id = '00000000-0000-4000-8000-000000000002';

do $$
declare
  product_id uuid := '00000000-0000-4000-8000-000000000002';
  order_id uuid;
  attempt integer;
begin
  for attempt in 1..3 loop
    perform public.create_order(jsonb_build_object(
      'customer_name', 'Test Customer', 'phone', '0347654321', 'address', 'Test address',
      'payment_mode', 'mvola', 'payer_name', 'Test Payer', 'ip_hash', 'phone-limit-test-ip',
      'items', jsonb_build_array(jsonb_build_object('product_id', product_id, 'qty', 1))
    ));
  end loop;
  begin
    perform public.create_order(jsonb_build_object(
      'customer_name', 'Test Customer', 'phone', '0347654321', 'address', 'Test address',
      'payment_mode', 'mvola', 'payer_name', 'Test Payer', 'ip_hash', 'phone-limit-test-ip',
      'items', jsonb_build_array(jsonb_build_object('product_id', product_id, 'qty', 1))
    ));
    raise exception 'ASSERTION FAILED: fourth order was accepted';
  exception when others then
    if sqlerrm <> 'Order limit reached for this phone' then raise; end if;
  end;

  order_id := public.create_order(jsonb_build_object(
    'customer_name', 'Test Customer', 'phone', '0329876543', 'address', 'Test address',
    'payment_mode', 'mvola', 'payer_name', 'Test Payer', 'ip_hash', 'unpaid-test-ip',
    'items', jsonb_build_array(jsonb_build_object('product_id', product_id, 'qty', 1))
  ));
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  begin
    perform public.confirm_order(order_id);
    raise exception 'ASSERTION FAILED: unpaid mobile-money order was confirmed';
  exception when others then
    if sqlerrm <> 'Payment must be confirmed before preparation' then raise; end if;
  end;
end;
$$;

rollback;