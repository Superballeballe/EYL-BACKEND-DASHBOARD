/**
 * Pay-first rules for app orders, shared by the lifecycle API and the action
 * buttons. They mirror the DB triggers in EYL-APP
 * (supabase/migrations/20261007140000_pay_within_30_minutes.sql):
 *
 *   guard_confirm_window: setting confirmed_at or assigned_knight_id needs a
 *   paid (or ₹0) invoice, an order that is not cancelled, and now() before
 *   confirm_deadline_at (when the order has one).
 *
 * Flow: customer pays -> ops (or a knight) confirm -> ops assign a knight.
 * Pure functions only; safe to import from client components.
 */

export type AppOrderGuardInput = {
  status?: string | null;
  confirmed_at?: string | null;
  confirm_deadline_at?: string | null;
};

export type AppInvoiceGuardInput = {
  payment_status?: string | null;
  total_amount?: number | string | null;
} | null;

export type AppOrderStage =
  | "cancelled"
  | "awaiting_payment"
  | "confirm_window_closed"
  | "ready_to_confirm"
  | "confirmed";

export const APP_ORDER_MESSAGES = {
  cancelled: "This app order was cancelled.",
  alreadyConfirmed: "Order is already confirmed.",
  awaitingPayment: "Waiting for the customer to pay. You can confirm once the payment comes in.",
  confirmWindowClosed:
    "The time to confirm this order has passed (1 hour before the pickup slot). The app will cancel and refund it.",
  assignNeedsConfirm: "Confirm the order before assigning a knight.",
  assignNeedsPayment: "Waiting for the customer to pay. Confirm the order once paid, then assign a knight.",
  assignWindowClosed:
    "The app no longer accepts a knight for this order because its confirmation deadline has passed. Contact tech to assign it.",
  saveFailed: "Could not update the app order. Please refresh and try again.",
} as const;

function isCancelledStatus(status: string | null | undefined) {
  const s = String(status ?? "").toLowerCase();
  return s === "cancelled" || s === "canceled";
}

/**
 * Same as the DB: invoice paid, or pending with a ₹0 total (order_invoice_is_free,
 * where a null total counts as 0). No invoice = not paid. A total that was not
 * loaded at all (undefined) is never treated as free.
 */
export function isInvoicePaidOrFree(invoice: AppInvoiceGuardInput): boolean {
  if (!invoice) return false;
  const status = String(invoice.payment_status ?? "").toLowerCase();
  if (status === "paid") return true;
  if (invoice.total_amount === undefined) return false;
  const total = Number(invoice.total_amount ?? 0);
  return status === "pending" && Number.isFinite(total) && total <= 0;
}

export function isPastDeadline(deadlineIso: string | null | undefined, now: Date = new Date()) {
  if (!deadlineIso) return false;
  const at = new Date(deadlineIso).getTime();
  return Number.isFinite(at) && now.getTime() >= at;
}

export function appOrderStage(
  order: AppOrderGuardInput | null | undefined,
  invoice: AppInvoiceGuardInput,
  now: Date = new Date(),
): AppOrderStage {
  if (isCancelledStatus(order?.status)) return "cancelled";
  if (order?.confirmed_at) return "confirmed";
  if (!isInvoicePaidOrFree(invoice)) return "awaiting_payment";
  if (isPastDeadline(order?.confirm_deadline_at, now)) return "confirm_window_closed";
  return "ready_to_confirm";
}

/** Why ops cannot confirm this app order right now, or null when they can. */
export function confirmBlockedReason(
  order: AppOrderGuardInput | null | undefined,
  invoice: AppInvoiceGuardInput,
  now: Date = new Date(),
): string | null {
  switch (appOrderStage(order, invoice, now)) {
    case "cancelled":
      return APP_ORDER_MESSAGES.cancelled;
    case "confirmed":
      return APP_ORDER_MESSAGES.alreadyConfirmed;
    case "awaiting_payment":
      return APP_ORDER_MESSAGES.awaitingPayment;
    case "confirm_window_closed":
      return APP_ORDER_MESSAGES.confirmWindowClosed;
    default:
      return null;
  }
}

/**
 * Why ops cannot assign a knight to this (non-cancelled) app order, or null.
 * `setsAppKnight` is true when the knight has an app profile, so the update
 * sets orders.assigned_knight_id and guard_confirm_window runs again.
 */
export function assignBlockedReason(
  order: AppOrderGuardInput | null | undefined,
  invoice: AppInvoiceGuardInput,
  { setsAppKnight, now = new Date() }: { setsAppKnight: boolean; now?: Date },
): string | null {
  if (!order?.confirmed_at) {
    return isInvoicePaidOrFree(invoice)
      ? APP_ORDER_MESSAGES.assignNeedsConfirm
      : APP_ORDER_MESSAGES.assignNeedsPayment;
  }
  if (!isInvoicePaidOrFree(invoice)) return APP_ORDER_MESSAGES.assignNeedsPayment;
  if (setsAppKnight && isPastDeadline(order.confirm_deadline_at, now)) {
    return APP_ORDER_MESSAGES.assignWindowClosed;
  }
  return null;
}

/** True for errors raised by the pay-first DB guards (never retry these with a smaller patch). */
export function isOrderGuardError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  return error.code === "P0001" || /not allowed:/i.test(error.message ?? "");
}

/** Friendly copy for a DB error from an orders update. Never returns the raw message. */
export function friendlyOrderUpdateError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  action: "confirm" | "assign",
): string {
  const message = error?.message ?? "";
  if (/not paid/i.test(message)) {
    return action === "confirm" ? APP_ORDER_MESSAGES.awaitingPayment : APP_ORDER_MESSAGES.assignNeedsPayment;
  }
  if (/confirmation window has closed/i.test(message)) {
    return action === "confirm" ? APP_ORDER_MESSAGES.confirmWindowClosed : APP_ORDER_MESSAGES.assignWindowClosed;
  }
  return APP_ORDER_MESSAGES.saveFailed;
}

/** "12 min", "1 h 5 min", or null when the deadline is missing or has passed. */
export function timeLeftLabel(deadlineIso: string | null | undefined, now: Date = new Date()): string | null {
  if (!deadlineIso) return null;
  const ms = new Date(deadlineIso).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalMinutes = Math.max(1, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
