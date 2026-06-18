-- =====================================================================
-- 0003_fulfillment_status.sql
--
-- Keeps dashboard deliveries and mobile app orders in the same lifecycle.
--
-- Dashboard fields:
--   deliveries.fulfillment_status = placed / picked_up / in_transit /
--                                  delivered / cancelled
--
-- App fields:
--   orders.status = registered / accepted / rider_assigned / picked_up /
--                   delivered / cancelled
--   orders.rider_name, accepted_at, rider_assigned_at,
--   pickup_scheduled_at, delivery_scheduled_at
--
-- Confirming and assigning are written by the dashboard lifecycle API because
-- they are order-level ops actions. This trigger mirrors fulfillment movement
-- from the dashboard delivery row. Dashboard in_transit means delivery started
-- and maps to the app's rider_assigned state; picked_up is only written by the
-- explicit Pickup action.
-- =====================================================================

-- 0. Fail clearly if applied out of order.
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'public.orders not found - apply the app schema before this migration';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deliveries' and column_name = 'app_order_id'
  ) then
    raise exception 'deliveries.app_order_id not found - apply 0002_orders_to_deliveries.sql first';
  end if;
end $$;

-- 1. Ops-controlled fulfillment status on deliveries.
alter table public.deliveries
  add column if not exists fulfillment_status text not null default 'placed'
    check (fulfillment_status in ('placed','picked_up','in_transit','delivered','cancelled'));

create index if not exists deliveries_fulfillment_status_idx
  on public.deliveries (fulfillment_status);

-- 2. Customer-facing order lifecycle columns read by the app.
alter table public.orders add column if not exists status text;
alter table public.orders alter column status set default 'registered';

-- Older copies of this migration created a narrower anonymous status CHECK.
-- Drop any status CHECK before installing the app-native lifecycle constraint.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
      from pg_constraint
     where conrelid = 'public.orders'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.orders drop constraint if exists %I', constraint_name);
  end loop;
end $$;

update public.orders
   set status =
     case
       when status is null or status = 'placed' then 'registered'
       when status = 'confirmed' then 'accepted'
       when status = 'assigned' then 'rider_assigned'
       when status = 'in_transit' then 'picked_up'
       when status = 'completed' then 'delivered'
       when status = 'canceled' then 'cancelled'
       else status
     end
 where status is null
    or status in ('placed','confirmed','assigned','in_transit','completed','canceled');

alter table public.orders
  alter column status set not null,
  add constraint orders_status_check
    check (status in ('registered','accepted','rider_assigned','picked_up','delivered','cancelled'));

alter table public.orders add column if not exists rider_name text;
alter table public.orders add column if not exists pickup_scheduled_at timestamptz;
alter table public.orders add column if not exists delivery_scheduled_at timestamptz;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists rider_assigned_at timestamptz;

create index if not exists orders_status_idx on public.orders (status);

-- 3. Mirror only fulfillment movement -> app status.
create or replace function public.sync_delivery_status_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped_status text;
begin
  if new.fulfillment_status = 'in_transit' then
    mapped_status := 'rider_assigned';
  elsif new.fulfillment_status = 'picked_up' then
    mapped_status := 'picked_up';
  elsif new.fulfillment_status = 'delivered' then
    mapped_status := 'delivered';
  elsif new.fulfillment_status = 'cancelled' then
    mapped_status := 'cancelled';
  else
    mapped_status := null;
  end if;

  if new.app_order_id is not null
     and mapped_status is not null
     and (tg_op = 'INSERT' or new.fulfillment_status is distinct from old.fulfillment_status)
  then
    update public.orders
       set status = mapped_status
     where id = new.app_order_id
       and status is distinct from mapped_status;
  end if;

  return new;
end;
$$;

drop trigger if exists deliveries_sync_status_to_order on public.deliveries;
create trigger deliveries_sync_status_to_order
  after insert or update of fulfillment_status on public.deliveries
  for each row
  execute function public.sync_delivery_status_to_order();

-- 4. Backfill active fulfillment states without downgrading accepted/assigned.
update public.orders o
   set status =
     case
       when d.fulfillment_status = 'in_transit' then 'rider_assigned'
       when d.fulfillment_status = 'picked_up' then 'picked_up'
       when d.fulfillment_status = 'delivered' then 'delivered'
       when d.fulfillment_status = 'cancelled' then 'cancelled'
       else o.status
     end
  from public.deliveries d
 where d.app_order_id = o.id
   and d.fulfillment_status in ('picked_up','in_transit','delivered','cancelled')
   and o.status is distinct from
     case
       when d.fulfillment_status = 'in_transit' then 'rider_assigned'
       when d.fulfillment_status = 'picked_up' then 'picked_up'
       when d.fulfillment_status = 'delivered' then 'delivered'
       when d.fulfillment_status = 'cancelled' then 'cancelled'
       else o.status
     end;

-- 5. Live updates: let the app subscribe to its own order rows.
alter table public.orders replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
