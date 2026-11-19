import { BUSINESS_TZ, fmtDatetimeLocal, toDatetimeLocalValue } from "./format";
import type { Delivery } from "./types";

type AppOrderTimes = Partial<
  Pick<
    NonNullable<Delivery["app_order"]>,
    "scheduled_for" | "pickup_scheduled_at" | "delivery_scheduled_at" | "created_at" | "invoices"
  >
>;

type ScheduleFields = Pick<Delivery, "app_order_id" | "pickup_time_window" | "drop_time_window"> & {
  app_order?: AppOrderTimes | null;
};

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

/** Length of the pickup slot the customer booked (30 minutes today), as the app stored it on the invoice. */
export function appSlotMinutes(order: Pick<AppOrderTimes, "invoices"> | null | undefined): number | null {
  const invoice = Array.isArray(order?.invoices) ? order?.invoices[0] : order?.invoices;
  const schedule = invoice?.metadata?.schedule;
  const minutes =
    schedule && typeof schedule === "object" ? Number((schedule as { windowMinutes?: unknown }).windowMinutes) : NaN;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function clockInBusinessTz(date: Date): string {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: BUSINESS_TZ });
}

/** "19 Nov, 01:30 pm – 02:00 pm": the booked pickup slot. Just the start when the slot length is unknown. */
function slotLabel(start: string, minutes: number | null): string {
  const from = fmtDatetimeLocal(start);
  const startAt = new Date(start);
  if (minutes == null || Number.isNaN(startAt.getTime())) return from;
  return `${from} – ${clockInBusinessTz(new Date(startAt.getTime() + minutes * 60_000))}`;
}

/**
 * The scheduled time to show at pickup and at drop. An app order with a text slot has one window, so both
 * read the same. Otherwise the delivery's own times win (ops set them exactly); an app booking that never
 * wrote them shows the pickup slot the customer booked, and the drop time once ops have set one.
 */
export function deliverySchedule(delivery: ScheduleFields): { pickup: string | null; drop: string | null } {
  const slot = appScheduleSlot(delivery);
  if (slot) return { pickup: slot, drop: slot };
  const order = delivery.app_order;
  const present = (value: string | null | undefined) => (value?.trim() ? value : null);
  const ownPickup = present(delivery.pickup_time_window);
  const appPickup = present(order?.pickup_scheduled_at) ?? present(order?.scheduled_for);
  const drop = present(delivery.drop_time_window) ?? present(order?.delivery_scheduled_at);
  return {
    pickup: ownPickup ? fmtDatetimeLocal(ownPickup) : appPickup ? slotLabel(appPickup, appSlotMinutes(order)) : null,
    drop: drop ? fmtDatetimeLocal(drop) : null,
  };
}

/**
 * When the job was booked: the moment the customer placed the app order, or for a dashboard
 * booking the moment the delivery row was created.
 */
export function bookedAt(delivery: Pick<Delivery, "created_at"> & { app_order?: Pick<AppOrderTimes, "created_at"> | null }): string {
  return delivery.app_order?.created_at || delivery.created_at;
}
