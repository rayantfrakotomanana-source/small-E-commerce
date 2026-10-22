do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_events'
    ) then
      execute 'alter publication supabase_realtime add table public.order_events';
    end if;
  end if;
end;
$$;

create policy order_events_livreur_assigned_read on public.order_events
  for select to authenticated
  using (
    public.caller_has_role(array['livreur']::public.user_role[])
    and exists (
      select 1 from public.orders o
      where o.id = order_events.order_id and o.livreur_id = (select auth.uid())
    )
  );