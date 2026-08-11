-- Sync payment + kms from app orders (coupon, lat/lng) and keep deliveries updated on order changes.

alter table public.deliveries
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists drop_lat double precision,
  add column if not exists drop_lng double precision;

alter table public.deliveries
  add column if not exists recipient_phone text;

create or replace function public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
) returns numeric
language sql
immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else round(
      (
        6371 * acos(
          least(
            1.0,
            greatest(
              -1.0,
              cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1))
              + sin(radians(lat1)) * sin(radians(lat2))
            )
          )
        )
      )::numeric,
      2
    )
  end;
$$;

create or replace function public.order_distance_km(o public.orders)
returns numeric
language sql
stable
as $$
  select coalesce(
    nullif(o.item_type->>'distance_km', '')::numeric,
    public.haversine_km(o.pickup_lat, o.pickup_lng, o.delivery_lat, o.delivery_lng),
    public.haversine_km(
      nullif(o.pickup->>'lat', '')::double precision,
      nullif(o.pickup->>'lng', '')::double precision,
      nullif(o.delivery->>'lat', '')::double precision,
      nullif(o.delivery->>'lng', '')::double precision
    )
  );
$$;

create or replace function public.order_payment_status(o public.orders)
returns text
language sql
stable
as $$
  select case
    when coalesce(o.total_price, 0) = 0 then 'paid'
    when lower(coalesce(o.payment_method->>'type', o.payment_method->>'method', '')) like '%coupon%' then 'paid'
    when lower(coalesce(o.payment_method->>'status', '')) in ('paid', 'success', 'completed') then 'paid'
    when lower(coalesce(o.payment_method->>'status', '')) in ('unpaid', 'pending', 'failed') then 'unpaid'
    when o.status in ('delivered', 'picked_up') then 'paid'
    else 'unpaid'
  end;
$$;

create or replace function public.order_payment_mode(o public.orders)
returns text
language sql
stable
as $$
  select case
    when coalesce(o.total_price, 0) = 0 then 'coupon'
    when lower(coalesce(o.payment_method->>'type', '')) like '%coupon%' then 'coupon'
    when nullif(trim(coalesce(o.payment_method->>'method', o.payment_method->>'type', '')), '') is not null
      then lower(trim(coalesce(o.payment_method->>'method', o.payment_method->>'type', '')))
    when o.status in ('delivered', 'picked_up') and coalesce(o.total_price, 0) > 0 then 'online'
    else null
  end;
$$;

create or replace function public.sync_order_to_delivery(o public.orders)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_date date;
begin
  v_task_date := coalesce(o.scheduled_for, o.pickup_scheduled_at, o.placed_at, o.created_at)::date;

  insert into public.deliveries (
    app_order_id,
    booking_date,
    task_date,
    mode_of_booking,
    sender_name,
    pickup_location,
    drop_location,
    drop_recipient_name,
    recipient_phone,
    pickup_lat,
    pickup_lng,
    drop_lat,
    drop_lng,
    fees,
    kms,
    payment_status,
    payment_mode,
    final_bill_amount,
    content,
    src_sheet,
    needs_review,
    raw
  )
  values (
    o.id,
    coalesce(o.placed_at, o.created_at)::date,
    v_task_date,
    'online',
    coalesce(o.item_type->>'sender_name', o.pickup->>'contact_name'),
    o.pickup_address,
    o.delivery_address,
    coalesce(o.recipient_name, o.delivery->>'contact_name'),
    coalesce(o.recipient_phone, o.delivery->>'contact_phone'),
    coalesce(o.pickup_lat, nullif(o.pickup->>'lat', '')::double precision),
    coalesce(o.pickup_lng, nullif(o.pickup->>'lng', '')::double precision),
    coalesce(o.delivery_lat, nullif(o.delivery->>'lat', '')::double precision),
    coalesce(o.delivery_lng, nullif(o.delivery->>'lng', '')::double precision),
    o.total_price,
    public.order_distance_km(o),
    public.order_payment_status(o),
    public.order_payment_mode(o),
    o.total_price,
    coalesce(o.item_type->>'label', o.delivery_type::text),
    'app',
    false,
    jsonb_build_object(
      'order_code', o.order_code,
      'recipient_phone', o.recipient_phone,
      'item_type', o.item_type,
      'payment_method', o.payment_method,
      'pickup', to_jsonb(o.pickup),
      'delivery', to_jsonb(o.delivery)
    )
  )
  on conflict (app_order_id) do update set
    task_date = excluded.task_date,
    sender_name = excluded.sender_name,
    pickup_location = excluded.pickup_location,
    drop_location = excluded.drop_location,
    drop_recipient_name = excluded.drop_recipient_name,
    recipient_phone = excluded.recipient_phone,
    pickup_lat = excluded.pickup_lat,
    pickup_lng = excluded.pickup_lng,
    drop_lat = excluded.drop_lat,
    drop_lng = excluded.drop_lng,
    fees = excluded.fees,
    kms = excluded.kms,
    payment_status = excluded.payment_status,
    payment_mode = excluded.payment_mode,
    final_bill_amount = excluded.final_bill_amount,
    content = excluded.content,
    raw = excluded.raw;
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

create or replace function public.orders_after_update()
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

drop trigger if exists orders_resync_to_deliveries on public.orders;
create trigger orders_resync_to_deliveries
  after update on public.orders
  for each row
  execute function public.orders_after_update();

-- Backfill existing app-linked deliveries.
select public.sync_order_to_delivery(o) from public.orders o;
