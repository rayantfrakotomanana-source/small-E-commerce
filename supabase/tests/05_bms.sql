begin;

insert into auth.users(id, aud, role, email)
values ('00000000-0000-4000-8000-000000000501', 'authenticated', 'authenticated', 'owner-test@example.invalid')
on conflict (id) do nothing;
insert into public.profiles(id, full_name, role, active)
values ('00000000-0000-4000-8000-000000000501', 'Owner Test', 'superadmin', true)
on conflict (id) do update set role='superadmin', active=true;

insert into public.bms_products(id, name, sku, purchase_price, selling_price, stock_quantity, minimum_stock)
values ('00000000-0000-4000-8000-000000000502', 'Test item', 'TEST-1', 1000, 1500, 10, 2);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000501', true);

do $$
declare
  sale_id uuid;
  remaining integer;
begin
  sale_id := public.bms_create_sale(
    null,
    100,
    '[{"product_id":"00000000-0000-4000-8000-000000000502","quantity":2}]'::jsonb,
    '[{"amount":1000,"method":"cash"}]'::jsonb,
    'Test sale',
    now()
  );
  select stock_quantity into remaining from public.bms_products where id='00000000-0000-4000-8000-000000000502';
  if remaining <> 8 then raise exception 'ASSERTION FAILED: stock should be 8, got %', remaining; end if;
  perform public.bms_cancel_sale(sale_id, 'Test cancellation');
  select stock_quantity into remaining from public.bms_products where id='00000000-0000-4000-8000-000000000502';
  if remaining <> 10 then raise exception 'ASSERTION FAILED: cancellation should restore stock, got %', remaining; end if;
  perform public.bms_record_expense(null, 'Test expense', 500, 'cash', current_date);
end;
$$;

rollback;
