create table public.order_idempotency (
  key text primary key,
  payload_hash text not null,
  order_id uuid not null references public.orders(id),
  created_at timestamptz not null default now()
);

create index order_idempotency_order_id_idx on public.order_idempotency(order_id);
alter table public.order_idempotency enable row level security;
revoke all on public.order_idempotency from anon, authenticated;
