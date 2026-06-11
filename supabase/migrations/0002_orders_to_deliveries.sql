-- =====================================================================
-- 0002_orders_to_deliveries.sql
--
-- Bridge the mobile app's customer bookings (public.orders, created by
-- EYL-APP-2) into the ops dashboard's `deliveries` table. After this
-- migration, every booking placed in the app automatically shows up in the
-- dashboard's delivery list, tagged with provenance `src_sheet = 'app'`.
--
-- Column mapping below tracks what the app actually inserts (EYL-APP-2
-- src/lib/orders.ts): order_code / pickup_address / delivery_address /
-- recipient_* / total_price, plus an `item_type` JSONB blob that carries the
-- description, distance and sender details, and a `payment_method` JSONB.
--
-- Prerequisite: the app schema must already exist (public.orders) —
-- see EYL-APP-2/supabase/schema.sql. Apply 0001_init.sql first, then the
-- app schema, then this file.
--
-- Idempotent: a back-reference column + unique guard means re-running the
-- backfill (or a replayed insert) never creates duplicate deliveries.
-- =====================================================================

-- 0. Fail clearly if applied out of order (orders must exist first).
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception
      'public.orders not found — apply the app schema (EYL-APP-2/supabase/schema.sql) before this migration';
  end if;
end $$;

-- 1. Back-reference: trace each delivery to its source order, and make the
--    sync idempotent. UNIQUE allows many NULLs, so manual/imported
--    deliveries (app_order_id IS NULL) are unaffected.
alter table public.deliveries
  add column if not exists app_order_id uuid references public.orders(id) on delete set null;

do $$
begin
  alter table public.deliveries
    add constraint deliveries_app_order_id_key unique (app_order_id);
exception
  when duplicate_object then null;   -- constraint already present; safe to re-run
end $$;

-- 2. Map a single order row -> a delivery row.
--    SECURITY DEFINER so the insert runs as the function owner (the table
--    owner, which is exempt from RLS) — the mobile app inserts orders as the
--    `authenticated` role, which has no write access to `deliveries`.
create or replace function public.sync_order_to_delivery(o public.orders)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.deliveries (
    app_order_id,
    booking_date,
    task_date,
    mode_of_booking,
    sender_name,
    pickup_location,
    drop_location,
    drop_recipient_name,
    fees,
    kms,
    content,
    src_sheet,
    needs_review,
    raw
  )
  values (
    o.id,
    o.created_at::date,
    o.created_at::date,                          -- no scheduled date in the app; default to booking day
    'online',                                    -- app bookings are always online
    o.item_type->>'sender_name',                 -- sender details live in the item_type blob
    o.pickup_address,
    o.delivery_address,
    o.recipient_name,
    o.total_price,                               -- numeric -> numeric(12,2)
    nullif(o.item_type->>'distance_km', '')::numeric,
    o.item_type->>'label',                       -- human description, e.g. "2kg sweets"
    'app',
    false,
    jsonb_build_object(
      'order_code',      o.order_code,
      'recipient_phone', o.recipient_phone,
      'item_type',       o.item_type,
      'payment_method',  o.payment_method
    )
  )
  on conflict (app_order_id) do nothing;         -- already synced -> no-op
end;
$$;

-- 3. Fire on every new order.
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

-- 4. Backfill any orders that predate this migration. ON CONFLICT in the
--    sync function makes this safe to re-run.
select public.sync_order_to_delivery(o) from public.orders o;
