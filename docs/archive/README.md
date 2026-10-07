# Archived migrations — DO NOT APPLY

## 0021_knight_status_syncs_delivery_and_push.sql

Moved out of `supabase/migrations/` on 2026-10-07. It was never applied to production.

It redefines `orders_after_status_to_delivery()` and `sync_delivery_status_to_order()`. Since the
EYL-APP backend migrations of 2026-10-07 (pay-first / refund hardening), the backend owns those
functions: they move the delivery and send the `order_confirmed` / `order_picked_up` /
`order_delivered` pushes once per order and stage through `notify_order_stage()` and the
`order_notifications` table. Applying this file would replace the backend's deduplicated
versions and send customer pushes through a different path (duplicates).

Kept for reference only. Any change to those functions belongs in the EYL-APP backend repo.
