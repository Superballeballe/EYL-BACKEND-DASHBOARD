-- Knight (and dashboard) order status writes must move deliveries.fulfillment_status
-- and send pickup/delivered Expo pushes. sync_order_to_delivery does not touch
-- fulfillment (address/payment sync only) so this trigger owns the lifecycle.

create extension if not exists pg_net;

create or replace function public.orders_after_status_to_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fulfillment text;
  v_title text;
  v_body text;
  v_type text;
  v_suffix text;
  v_messages jsonb;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_fulfillment := case
    when new.status in ('placed', 'registered', 'pending', 'confirmed') then 'booked'
    when new.status in ('accepted', 'assigned', 'rider_assigned') then 'accepted'
    when new.status in ('picked_up', 'in_transit') then 'active'
    when new.status in ('delivered', 'completed') then 'completed'
    when new.status in ('cancelled', 'canceled') then 'cancelled'
    else null
  end;

  if v_fulfillment is not null then
    update public.deliveries
       set fulfillment_status = v_fulfillment,
           pickup_actual_time = case
             when v_fulfillment in ('active', 'completed')
               then coalesce(pickup_actual_time, to_char((now() at time zone 'Asia/Kolkata'), 'HH24:MI'))
             else pickup_actual_time
           end,
           drop_actual_time = case
             when v_fulfillment = 'completed'
               then coalesce(drop_actual_time, to_char((now() at time zone 'Asia/Kolkata'), 'HH24:MI'))
             else drop_actual_time
           end
     where app_order_id = new.id
       and fulfillment_status is distinct from v_fulfillment
       and not (
         fulfillment_status in ('completed', 'cancelled')
         and v_fulfillment not in ('completed', 'cancelled')
       );
  end if;

  if new.status in ('picked_up', 'in_transit')
     and old.status not in ('picked_up', 'in_transit', 'delivered', 'completed') then
    v_type := 'order_picked_up';
    v_title := 'Picked up';
    v_body := 'Your parcel has been picked up.';
  elsif new.status in ('delivered', 'completed')
     and old.status not in ('delivered', 'completed') then
    v_type := 'order_delivered';
    v_title := 'Delivered';
    v_body := 'Your order has been delivered.';
  end if;

  if v_type is not null and new.user_id is not null then
    v_suffix := case when new.order_code is not null then ' · ' || new.order_code else '' end;
    select jsonb_agg(
      jsonb_build_object(
        'to', t.token,
        'sound', 'default',
        'title', v_title,
        'body', v_body || v_suffix,
        'data', jsonb_build_object(
          'type', v_type,
          'orderId', new.id,
          'orderCode', new.order_code
        )
      )
    )
      into v_messages
      from public.app_push_tokens t
     where t.user_id = new.user_id
       and t.enabled is true
       and t.token ~ '^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$';

    if v_messages is not null then
      begin
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
          body := v_messages,
          timeout_milliseconds := 5000
        );
      exception when others then
        raise warning 'order status push failed: %', sqlerrm;
      end;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_delivery_status_to_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped_status text;
begin
  if new.fulfillment_status = 'accepted' then
    mapped_status := 'accepted';
  elsif new.fulfillment_status = 'active' then
    mapped_status := 'picked_up';
  elsif new.fulfillment_status = 'completed' then
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
       and status is distinct from mapped_status
       and (
         mapped_status <> 'accepted'
         or status not in (
           'assigned', 'rider_assigned', 'picked_up', 'in_transit',
           'delivered', 'cancelled', 'canceled'
         )
       )
       and status not in ('delivered', 'cancelled', 'canceled', 'in_transit');
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
