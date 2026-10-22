/**
 * Pure helpers for the new-order sound (see components/NewOrderAlert.tsx and
 * app/api/deliveries/stream/route.ts). No browser-only imports so it can be
 * unit-tested.
 */
import { appOrderStage } from "@/lib/appOrderLifecycle";

/** Each new order rings this long at most; confirming it sooner stops it sooner. */
export const ORDER_ALERT_RING_MS = 10_000;

/**
 * The app order id when this realtime `deliveries` change is a customer order
 * arriving, else null.
 *
 * App and WhatsApp bookings reach `deliveries` through `sync_order_to_delivery`,
 * which inserts the row with `app_order_id` set (later syncs update it in
 * place). Deliveries typed into the dashboard or imported have no
 * `app_order_id`; the operator made those, so they don't ring.
 */
export function incomingOrderId(change: { eventType: string; new: Record<string, unknown> }): string | null {
  if (change.eventType !== "INSERT") return null;
  const appOrderId = change.new.app_order_id;
  return typeof appOrderId === "string" && appOrderId.length > 0 ? appOrderId : null;
}

/**
 * The order whose alert should stop, from a realtime `orders` change: it was
 * confirmed, given a knight, cancelled or deleted. Null for any other change.
 *
 * Not the delivery's fulfillment_status: 0020 moves that to "accepted" as soon
 * as the customer pays, before ops confirm.
 */
export function settledOrderId(change: {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}): string | null {
  if (change.eventType === "DELETE") return typeof change.old.id === "string" ? change.old.id : null;
  const order = change.new;
  if (typeof order.id !== "string") return null;
  const stage = appOrderStage(
    { status: order.status as string | null, confirmed_at: order.confirmed_at as string | null },
    null,
  );
  return stage === "confirmed" || stage === "cancelled" || order.assigned_knight_id ? order.id : null;
}
