-- =====================================================================
-- APPLY_app_sync.sql  —  ONE-SHOT FIX for "deliveries from the app
-- aren't showing up in the dashboard".
--
-- Run this ONCE in the Supabase SQL editor for project
-- mjoddxztryqjtjaseusc (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- It bundles, in dependency order:
--   1. The app's orders table            (EYL-APP/supabase/schema.sql)
--   2. orders -> deliveries sync trigger  (migrations/0002_orders_to_deliveries.sql)
--   3. app-native lifecycle back-sync     (migrations/0003_fulfillment_status.sql)
--
-- All three are idempotent (IF NOT EXISTS / OR REPLACE / guarded), so
-- re-running is safe. After it completes, the verification query at the
-- bottom should show your app bookings as deliveries with src_sheet='app'.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1 — the mobile app's orders table (from EYL-APP/supabase/schema.sql)
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  order_code       text not null unique,
  pickup_address   text not null,
  delivery_address text not null,
  recipient_name   text,
  recipient_phone  text,
  total_price      numeric(12,2) not null,
  item_type        jsonb,
  payment_method   jsonb,
  status           text not null default 'registered',
  rider_name       text,
  pickup_scheduled_at   timestamptz,
  delivery_scheduled_at timestamptz,
  accepted_at      timestamptz,
  rider_assigned_at timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.orders add column if not exists status text;
alter table public.orders alter column status set default 'registered';

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

alter table public.orders enable row level security;

do $$ begin
  create policy "read own orders" on public.orders for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insert own orders" on public.orders for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create index if not exists orders_user_id_idx    on public.orders (user_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);


-- ---------------------------------------------------------------------
-- STEP 2 — orders -> deliveries sync (migrations/0002_orders_to_deliveries.sql)
-- ---------------------------------------------------------------------
alter table public.deliveries
  add column if not exists app_order_id uuid references public.orders(id) on delete set null;

do $$
begin
  alter table public.deliveries
    add constraint deliveries_app_order_id_key unique (app_order_id);
exception
  when duplicate_object then null;
end $$;

create or replace function public.sync_order_to_delivery(o public.orders)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deliveries (
    app_order_id, booking_date, task_date, mode_of_booking,
    sender_name, pickup_location, drop_location, drop_recipient_name,
    fees, kms, content, src_sheet, needs_review, raw
  )
  values (
    o.id,
    o.created_at::date,
    o.created_at::date,
    'online',
    o.item_type->>'sender_name',
    o.pickup_address,
    o.delivery_address,
    o.recipient_name,
    o.total_price,
    nullif(o.item_type->>'distance_km', '')::numeric,
    o.item_type->>'label',
    'app',
    false,
    jsonb_build_object(
      'order_code',      o.order_code,
      'recipient_phone', o.recipient_phone,
      'item_type',       o.item_type,
      'payment_method',  o.payment_method
    )
  )
  on conflict (app_order_id) do nothing;
end;
$$;

create or replace function public.orders_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_order_to_delivery(new);
  return new;
end;
$$;

drop trigger if exists orders_sync_to_deliveries on public.orders;
create trigger orders_sync_to_deliveries
  after insert on public.orders
  for each row
  execute function public.orders_after_insert();

-- Backfill any orders that already exist (idempotent via ON CONFLICT).
select public.sync_order_to_delivery(o) from public.orders o;


-- ---------------------------------------------------------------------
-- STEP 3 — fulfillment status + app lifecycle back-sync (migrations/0003_fulfillment_status.sql)
-- ---------------------------------------------------------------------
alter table public.deliveries
  add column if not exists fulfillment_status text not null default 'placed'
    check (fulfillment_status in ('placed','picked_up','in_transit','delivered','cancelled'));

create index if not exists deliveries_fulfillment_status_idx
  on public.deliveries (fulfillment_status);

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

alter table public.orders replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;


-- ---------------------------------------------------------------------
-- VERIFY — should report the orders table, the trigger, and any synced rows.
-- ---------------------------------------------------------------------
select
  (select count(*) from public.orders)                              as orders_count,
  (select count(*) from public.deliveries where src_sheet = 'app')  as synced_deliveries,
  (select count(*) from pg_trigger
     where tgname = 'orders_sync_to_deliveries')                    as sync_trigger_present;
