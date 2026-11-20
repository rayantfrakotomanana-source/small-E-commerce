-- The BMS has one owner. Existing profiles remain untouched; public signup is not used.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, phone, role, active)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email, 'Owner'), nullif(new.raw_user_meta_data->>'phone', ''), 'superadmin', false)
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone;
  return new;
end;
$$;

-- The owner profile must be activated manually in Supabase Auth/profiles once.
-- The application will also reject profile roles other than superadmin.
