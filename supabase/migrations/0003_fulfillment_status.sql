-- =====================================================================
-- 0003_fulfillment_status.sql
--
-- Adds a customer-facing delivery lifecycle status and wires it back to
-- the mobile app.
--
-- Flow:
--   1. Ops sets `deliveries.fulfillment_status` in the dashboard.
--   2. A trigger mirrors that value onto the linked `public.orders.status`
--      (matched via deliveries.app_order_id -> orders.id, added in 0002).
--   3. The mobile app (EYL-APP-2) reads orders.status under its existing
--      "read own orders" RLS policy, and gets live pushes because orders
--      is added to the supabase_realtime publication below.
--
-- Lifecycle: placed -> picked_up -> in_transit -> delivered (+ cancelled).
-- "delivered" is treated as completed by the app.
--
-- Prerequisite: 0002_orders_to_deliveries.sql (provides deliveries.app_order_id).
-- Idempotent: guarded with IF NOT EXISTS / OR REPLACE / catch blocks.
-- =====================================================================

-- 0. Fail clearly if applied out of order.
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'public.orders not found — apply the app schema before this migration';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deliveries' and column_name = 'app_order_id'
  ) then
    raise exception 'deliveries.app_order_id not found — apply 0002_orders_to_deliveries.sql first';
  end if;
end $$;

-- 1. Ops-controlled fulfillment status on deliveries.
alter table public.deliveries
  add column if not exists fulfillment_status text not null default 'placed'
    check (fulfillment_status in ('placed','picked_up','in_transit','delivered','cancelled'));

create index if not exists deliveries_fulfillment_status_idx
  on public.deliveries (fulfillment_status);

-- 2. Customer-facing status mirror on orders (read by the app).
alter table public.orders
  add column if not exists status text not null default 'placed'
    check (status in ('placed','picked_up','in_transit','delivered','cancelled'));

-- 3. Mirror delivery status -> order status whenever ops changes it.
create or replace function public.sync_delivery_status_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.app_order_id is not null
     and (tg_op = 'INSERT' or new.fulfillment_status is distinct from old.fulfillment_status)
  then
    update public.orders
       set status = new.fulfillment_status
     where id = new.app_order_id
       and status is distinct from new.fulfillment_status;
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_sync_status_to_order on public.deliveries;
create trigger deliveries_sync_status_to_order
  after insert or update of fulfillment_status on public.deliveries
  for each row
  execute function public.sync_delivery_status_to_order();

-- 4. Backfill: align existing orders with their delivery's status.
update public.orders o
   set status = d.fulfillment_status
  from public.deliveries d
 where d.app_order_id = o.id
   and o.status is distinct from d.fulfillment_status;

-- 5. Live updates: let the app subscribe to its own order rows.
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;   -- already in the publication; safe to re-run
  when undefined_object then null;   -- publication absent (non-Supabase pg); ignore
end $$;
