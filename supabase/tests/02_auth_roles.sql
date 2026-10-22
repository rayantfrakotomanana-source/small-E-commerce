begin;

insert into auth.users(id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'courier-a@example.invalid', '{"full_name":"Courier A","role":"superadmin"}'),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'courier-b@example.invalid', '{"full_name":"Courier B","role":"admin"}')
on conflict (id) do nothing;

do $$
declare
  signup_role public.user_role;
  signup_active boolean;
begin
  select role, active into signup_role, signup_active
  from public.profiles where id = '00000000-0000-4000-8000-000000000101';
  if signup_role <> 'livreur' or signup_active then
    raise exception 'ASSERTION FAILED: signup metadata selected role or activated account';
  end if;
end;
$$;

update public.profiles set role = 'livreur', active = true
where id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102');

insert into public.orders (
  id, order_number, public_token, customer_name, phone, address, items_total,
  delivery_fee, payment_mode, payer_name, livreur_id
) values
  ('00000000-0000-4000-8000-000000000201', 'JR-TEST-A', 'test-token-a', 'Customer A', '0341234567', 'Address A', 1000, 5000, 'cash', null, '00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000202', 'JR-TEST-B', 'test-token-b', 'Customer B', '0341234568', 'Address B', 2000, 5000, 'mvola', 'Courier B', '00000000-0000-4000-8000-000000000102');

set local role anon;
do $$
begin
  begin
    perform count(*) from public.orders;
    raise exception 'ASSERTION FAILED: anon read orders';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
do $$
declare
  visible_orders integer;
begin
  select count(*) into visible_orders from public.orders;
  if visible_orders <> 1 then
    raise exception 'ASSERTION FAILED: courier A saw % orders instead of 1', visible_orders;
  end if;
  if exists (select 1 from public.orders where id = '00000000-0000-4000-8000-000000000202') then
    raise exception 'ASSERTION FAILED: courier A read courier B order';
  end if;
  begin
    update public.orders set items_total = 1
    where id = '00000000-0000-4000-8000-000000000201';
    raise exception 'ASSERTION FAILED: courier changed order price';
  exception when insufficient_privilege then
    null;
  end;
  begin
    update public.orders set payment_status = 'paye'
    where id = '00000000-0000-4000-8000-000000000201';
    raise exception 'ASSERTION FAILED: courier changed payment status';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;
reset role;

rollback;
