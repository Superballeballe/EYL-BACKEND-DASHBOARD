/**
 * Pure helpers for the new-order sound (see components/NewOrderAlert.tsx and
 * app/api/deliveries/stream/route.ts). No browser-only imports so it can be
 * unit-tested.
 */

/** Several orders landing together ring once, not as a pile of overlapping chimes. */
export const ORDER_ALERT_MIN_GAP_MS = 2_000;

/**
 * Is this realtime `deliveries` change a customer order arriving?
 *
 * App and WhatsApp bookings reach `deliveries` through `sync_order_to_delivery`,
 * which inserts the row with `app_order_id` set (later syncs update it in
 * place). Deliveries typed into the dashboard or imported have no
 * `app_order_id`; the operator made those, so they don't ring.
 */
export function isIncomingOrder(change: { eventType: string; new: Record<string, unknown> }): boolean {
  if (change.eventType !== "INSERT") return false;
  const appOrderId = change.new.app_order_id;
  return typeof appOrderId === "string" && appOrderId.length > 0;
}

/** Ring unless the last chime was under `ORDER_ALERT_MIN_GAP_MS` ago. */
export function shouldChime(lastChimeAt: number | null, now: number): boolean {
  return lastChimeAt === null || now - lastChimeAt >= ORDER_ALERT_MIN_GAP_MS;
}
