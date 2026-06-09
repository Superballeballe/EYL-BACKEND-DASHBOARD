-- =====================================================================
-- 0002_orders_to_deliveries.sql
--
-- Bridge the mobile app's customer bookings (public.orders, created by
-- EYL-APP-2) into the ops dashboard's `deliveries` table. After this
-- migration, every booking placed in the app automatically shows up in the
-- dashboard's delivery list, tagged with provenance `src_sheet = 'app'`.
--
-- Prerequisite: the app schema must already exist (public.orders) —
-- see EYL-APP-2/supabase/schema.sql. Apply 0001_init.sql first, then the
-- app schema, then this file.
--
-- Idempotent: a back-reference column + unique guard means re-running the
-- backfill (or a replayed insert) never creates duplicate deliveries.
-- =====================================================================

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
    o.created_at::date,                       -- no scheduled date in the app; default to booking day
    'online',                                 -- app bookings are always online
    coalesce(o.sender_name, o.user_name),
    o.pickup_label,
    o.drop_label,
    o.recipient_name,
    o.price,                                  -- integer -> numeric(12,2)
    o.distance_km,
    nullif(trim(coalesce(o.weight_kg::text, '') || ' kg'), 'kg'),
    'app',
    false,
    jsonb_build_object(
      'order_id',        o.order_id,
      'user_name',       o.user_name,
      'user_phone',      o.user_phone,
      'sender_phone',    o.sender_phone,
      'recipient_phone', o.recipient_phone,
      'weight_kg',       o.weight_kg,
      'pickup', jsonb_build_object('label', o.pickup_label, 'lat', o.pickup_lat, 'lon', o.pickup_lon),
      'drop',   jsonb_build_object('label', o.drop_label,   'lat', o.drop_lat,   'lon', o.drop_lon)
    )
  )
  on conflict (app_order_id) do nothing;      -- already synced -> no-op
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
