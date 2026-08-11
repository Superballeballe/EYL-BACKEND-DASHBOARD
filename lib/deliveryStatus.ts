/** App order cancelled but delivery row not synced yet. */
export function isAppOrderCancelled(appOrder?: { status?: string | null } | null): boolean {
  const s = appOrder?.status?.toLowerCase();
  return s === "cancelled" || s === "canceled";
}

export function effectiveFulfillmentStatus(delivery: {
  fulfillment_status?: string | null;
  app_order?: { status?: string | null } | null;
}): string | null {
  if (isAppOrderCancelled(delivery.app_order)) return "cancelled";
  return delivery.fulfillment_status ?? null;
}
