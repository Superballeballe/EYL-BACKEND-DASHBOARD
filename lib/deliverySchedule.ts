import { fmtDatetimeLocal, toDatetimeLocalValue } from "./format";
import type { Delivery } from "./types";

type ScheduleFields = Pick<Delivery, "app_order_id" | "pickup_time_window" | "drop_time_window">;

/**
 * The slot the customer chose in the app, exactly as the app wrote it (e.g. "Tue, 13 Oct · 11:00 AM – 2:00 PM").
 * The app stores it as text on the pickup; it is the window for the whole job, not just the pickup.
 * Null for a manual booking, or once someone has replaced the slot with an exact time.
 */
export function appScheduleSlot(delivery: ScheduleFields): string | null {
  if (!delivery.app_order_id) return null;
  const slot = delivery.pickup_time_window?.trim();
  if (!slot || toDatetimeLocalValue(slot)) return null;
  return slot;
}

/** The scheduled time to show at pickup and at drop. An app order has one slot, so both read the same. */
export function deliverySchedule(delivery: ScheduleFields): { pickup: string | null; drop: string | null } {
  const slot = appScheduleSlot(delivery);
  if (slot) return { pickup: slot, drop: slot };
  const label = (value: string | null) => (value?.trim() ? fmtDatetimeLocal(value) : null);
  return { pickup: label(delivery.pickup_time_window), drop: label(delivery.drop_time_window) };
}
