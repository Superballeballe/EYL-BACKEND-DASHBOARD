-- orders.status: accept every status the consumer app writes.
--
-- 0003_fulfillment_status.sql replaced orders_status_check with the dashboard's
-- vocabulary only (registered, accepted, rider_assigned, picked_up, delivered,
-- cancelled). The app's create_booking writes 'placed' and drafts write
-- 'draft', so wherever 0003 runs after the app's schema, every booking fails
-- with "violates check constraint orders_status_check".
--
-- Production is not affected today: the app's snippets
-- (EYL-APP/supabase/snippets/draft-orders.sql) re-created the constraint with
-- the full list after 0003 ran. This migration makes the dashboard repo agree
-- with that, so a fresh environment built from both repos in any order works.
-- 0003 is left untouched (it has already run where it ran); do not re-run it.
--
-- The list is the app's (EYL-APP/supabase/snippets/draft-orders.sql), a
-- superset of 0003's, so every existing row still passes. Idempotent.
--
-- Rollback (only if you really want 0003's narrow list back, which breaks
-- bookings): re-run the constraint block from 0003.

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'draft', 'placed', 'picked_up', 'in_transit', 'delivered', 'cancelled',
    'pending', 'registered', 'accepted', 'rider_assigned', 'assigned'
  ));
