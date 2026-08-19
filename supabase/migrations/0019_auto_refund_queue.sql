-- Auto-refund audit log + realtime on cancelled_orders for the ops SSE queue.

create table if not exists public.refund_events (
  id                  uuid primary key default gen_random_uuid(),
  cancelled_order_id  uuid references public.cancelled_orders(id) on delete set null,
  order_id            uuid,
  order_code          text,
  source              text not null check (source in ('manual', 'auto', 'cron')),
  status              text not null check (status in ('success', 'failed', 'skipped')),
  refund_ref          text,
  amount              integer,
  error               text,
  created_at          timestamptz not null default now()
);

create index if not exists refund_events_created_at_idx
  on public.refund_events (created_at desc);
create index if not exists refund_events_cancelled_order_idx
  on public.refund_events (cancelled_order_id);

alter table public.refund_events enable row level security;

do $$ begin
  alter publication supabase_realtime add table public.cancelled_orders;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
