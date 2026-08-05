-- =====================================================================
-- 0005_fulfillment_status_rename.sql
--
-- Renames deliveries.fulfillment_status to the ops-facing lifecycle
-- vocabulary and reorders it to match how it's actually used:
--
--   placed     -> booked     (default, no knight assigned yet)
--   in_transit -> accepted   (assign action's target - was set as soon as
--                             a knight was assigned, before physical pickup)
--   picked_up  -> active     (explicit Pickup action's target - knight has
--                             physically picked up the parcel and is en route)
--   delivered  -> completed
--   cancelled  -> cancelled  (unchanged)
--
-- Does not touch orders.status (customer-facing app lifecycle), which keeps
-- its own registered/accepted/rider_assigned/picked_up/delivered/cancelled
-- values - the "accepted" there is an unrelated column on a different table.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'deliveries' and column_name = 'fulfillment_status'
  ) then
    raise exception 'deliveries.fulfillment_status not found - apply 0003_fulfillment_status.sql first';
  end if;
end $$;

-- 1. Drop the old CHECK constraint (name may vary; search for it by definition).
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
      from pg_constraint
     where conrelid = 'public.deliveries'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%fulfillment_status%'
  loop
    execute format('alter table public.deliveries drop constraint if exists %I', constraint_name);
  end loop;
end $$;

-- 2. Rename existing stored values to the new vocabulary (note the reorder).
update public.deliveries
   set fulfillment_status =
     case fulfillment_status
       when 'placed' then 'booked'
       when 'in_transit' then 'accepted'
       when 'picked_up' then 'active'
       when 'delivered' then 'completed'
       else fulfillment_status
     end
 where fulfillment_status in ('placed', 'in_transit', 'picked_up', 'delivered');

-- 3. Re-add the default and CHECK with the new value set.
alter table public.deliveries
  alter column fulfillment_status set default 'booked';

alter table public.deliveries
  add constraint deliveries_fulfillment_status_check
    check (fulfillment_status in ('booked', 'accepted', 'active', 'completed', 'cancelled'));

-- 4. Update the sync trigger to key off the new dashboard-side literals.
-- The mapped_status values (orders.status) are unchanged - only the
-- fulfillment_status literals being matched on the left-hand side change.
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
    mapped_status := 'rider_assigned';
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
       and status is distinct from mapped_status;
  end if;

  return new;
end;
$$;
