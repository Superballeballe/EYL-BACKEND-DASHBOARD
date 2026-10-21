-- deliveries.kms was pickup -> first drop as the crow flies, so a multi-drop
-- order read 3 km on the dashboard while the customer paid for 14 km. The app's
-- reprice_order sums every leg (pickup -> stop 1 -> ... -> pickup on a round
-- trip) and stores that total on the order's base_fare line in order_amounts.
-- Use it, keeping the coordinate fallback for orders without a priced fare line.

create or replace function public.order_distance_km(o public.orders)
returns numeric
language sql
stable
as $$
  select coalesce(
    (
      select nullif(a.metadata->>'distance_km', '')::numeric
        from public.order_amounts a
       where a.order_id = o.id
         and a.kind = 'base_fare'
       limit 1
    ),
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

-- reprice_order writes order_amounts before it updates orders, so the orders
-- trigger already sees the new distance. An address change that keeps the paid
-- fee updates orders first and patches distance_km afterwards; follow that too.
create or replace function public.order_amounts_sync_delivery_kms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.deliveries d
     set kms = public.order_distance_km(o)
    from public.orders o
   where o.id = new.order_id
     and d.app_order_id = o.id
     and d.kms is distinct from public.order_distance_km(o);
  return null;
end;
$$;

drop trigger if exists order_amounts_sync_delivery_kms on public.order_amounts;
create trigger order_amounts_sync_delivery_kms
  after insert or update of metadata on public.order_amounts
  for each row
  when (new.kind = 'base_fare')
  execute function public.order_amounts_sync_delivery_kms();

-- Backfill app-linked deliveries.
update public.deliveries d
   set kms = public.order_distance_km(o)
  from public.orders o
 where d.app_order_id = o.id
   and d.kms is distinct from public.order_distance_km(o);
