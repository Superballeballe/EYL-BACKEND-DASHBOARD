/** App order cancelled but delivery row not synced yet. */
export function isAppOrderCancelled(appOrder?: { status?: string | null } | null): boolean {
  const s = appOrder?.status?.toLowerCase();
  return s === "cancelled" || s === "canceled";
}

/** App order purged from consumer app — dashboard delivery shell should not show. */
export function isPurgedAppDelivery(delivery: {
  mode_of_booking?: string | null;
  app_order_id?: string | null;
  fulfillment_status?: string | null;
  app_order?: { status?: string | null } | null;
}): boolean {
  if (delivery.mode_of_booking !== "online") return false;
  if (delivery.app_order_id && !delivery.app_order) return true;
  return !delivery.app_order_id && delivery.fulfillment_status === "cancelled";
}

export function effectiveFulfillmentStatus(delivery: {
  fulfillment_status?: string | null;
  app_order?: { status?: string | null } | null;
}): string | null {
  if (isAppOrderCancelled(delivery.app_order)) return "cancelled";
  return delivery.fulfillment_status ?? null;
}
