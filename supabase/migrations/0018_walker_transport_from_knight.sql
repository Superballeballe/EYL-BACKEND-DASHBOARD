-- Sync knight-chosen walker transport from app orders into dashboard deliveries.

alter table public.orders
  add column if not exists walker_transport_mode text
    check (walker_transport_mode in ('cab', 'public_transit')),
  add column if not exists walker_transport_fare_inr numeric(12,2),
  add column if not exists walker_transport_set_at timestamptz;

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
    cab_auto_fare,
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
    case
      when o.walker_transport_mode = 'cab' and o.walker_transport_fare_inr is not null
        then o.walker_transport_fare_inr::text
      when o.walker_transport_mode = 'public_transit'
        then 'public_transit'
      else null
    end,
    coalesce(o.item_type->>'label', o.delivery_type::text),
    'app',
    false,
    jsonb_build_object(
      'order_code', o.order_code,
      'recipient_phone', o.recipient_phone,
      'item_type', o.item_type,
      'payment_method', o.payment_method,
      'pickup', to_jsonb(o.pickup),
      'delivery', to_jsonb(o.delivery),
      'walker_transport_mode', o.walker_transport_mode,
      'walker_transport_fare_inr', o.walker_transport_fare_inr,
      'walker_transport_set_at', o.walker_transport_set_at
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
    cab_auto_fare = excluded.cab_auto_fare,
    content = excluded.content,
    raw = excluded.raw;
end;
$$;

update public.pricing_config
   set value = jsonb_set(
     coalesce(value, '{}'::jsonb),
     '{transport_choice_source}',
     '"knight_app"'::jsonb,
     true
   )
 where key = 'walker_transport';

notify pgrst, 'reload schema';
