/**
 * Pure refund helpers shared by the Refunds page, the order page and the
 * lifecycle cancel. No I/O here (tested in refunds.test.ts).
 *
 * Business rules (EYL-APP docs/payment-safety.md):
 * - Automatic refunds are the DB worker's job (rule A: paid, not confirmed
 *   within 30 minutes of payment; rule B: paid after the order was cancelled;
 *   and any cancellation before pickup, refunded 100%).
 * - Wrong-amount / duplicate payments are never automatic: payment_reviews.
 * - Every refund owns one payment_refunds row keyed by razorpay_payment_id.
 */

export type CancelledRefundStatus = "none" | "pending" | "processing" | "refunded" | "failed";

export type ChipColor = "default" | "warning" | "info" | "success" | "error";

export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || !Number.isFinite(Number(paise))) return "—";
  const rupees = Number(paise) / 100;
  return (
    "₹" +
    rupees.toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Rupees (int or decimal) to paise, rounded. */
export function rupeesToPaise(rupees: number | null | undefined): number {
  const n = Number(rupees ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** cancelled_orders.refund_status → label + chip colour. Unknown values show raw. */
export function refundStatusInfo(status: string | null | undefined): { label: string; color: ChipColor } {
  switch (status) {
    case "none":
    case null:
    case undefined:
    case "":
      return { label: "No refund", color: "default" };
    case "pending":
      return { label: "Queued", color: "warning" };
    case "processing":
      return { label: "Sent to Razorpay", color: "info" };
    case "refunded":
      return { label: "Refunded", color: "success" };
    case "failed":
      return { label: "Failed · needs ops", color: "error" };
    default:
      return { label: String(status), color: "default" };
  }
}

/** payment_refunds.status → label + colour. */
export function ledgerStatusInfo(status: string | null | undefined): { label: string; color: ChipColor } {
  switch (status) {
    case "claimed":
      return { label: "Live", color: "info" };
    case "dry_run":
      return { label: "Dry run · not sent", color: "warning" };
    case "skipped":
      return { label: "Skipped · mode off", color: "default" };
    default:
      return { label: status ? String(status) : "—", color: "default" };
  }
}

const ORIGIN_LABELS: Record<string, string> = {
  rule_a_not_confirmed: "Not confirmed within 30 min",
  rule_b_paid_after_cancel: "Paid after cancel",
  customer_cancel: "Customer cancelled",
  confirmed_cancel: "Confirmed order cancelled",
  ops: "Ops",
  review_manual: "Payment review (ops)",
  reconcile: "Lost payment (reconcile)",
};

/** payment_refunds.origin → why this refund exists. */
export function refundOriginLabel(origin: string | null | undefined): string {
  if (!origin) return "—";
  return ORIGIN_LABELS[origin] ?? origin;
}

/**
 * Same rule as public.refund_origin_of, for rows the ledger has not seen
 * (e.g. before the 20261012150000 migration is applied).
 */
export function originOfCancellation(row: {
  reason_code?: string | null;
  reason_label?: string | null;
  reason_note?: string | null;
  was_confirmed?: boolean | null;
}): string {
  if ((row.reason_note ?? "").startsWith("ops:")) return "ops";
  if (row.was_confirmed) return "confirmed_cancel";
  if (row.reason_label === "Paid after cancellation" || row.reason_label === "Paid after the payment window closed") {
    return "rule_b_paid_after_cancel";
  }
  if (row.reason_code === "not_confirmed") return "rule_a_not_confirmed";
  return "customer_cancel";
}

export type ReviewKind = "wrong_amount" | "duplicate" | "other";
export type ReviewStatus = "open" | "refunded" | "resolved";

export function reviewKindLabel(kind: string | null | undefined): string {
  if (kind === "wrong_amount") return "Wrong amount";
  if (kind === "duplicate") return "Duplicate";
  if (kind === "other") return "Other";
  return kind ? String(kind) : "—";
}

export function reviewStatusInfo(status: string | null | undefined): { label: string; color: ChipColor } {
  if (status === "open") return { label: "Needs review", color: "warning" };
  if (status === "refunded") return { label: "Refunded", color: "success" };
  if (status === "resolved") return { label: "Resolved", color: "default" };
  return { label: status ? String(status) : "—", color: "default" };
}

/** A refund attempt holds the row: disable the buttons until the lease ends. */
export function isLeaseActive(leaseUntil: string | null | undefined, now: Date = new Date()): boolean {
  if (!leaseUntil) return false;
  const t = new Date(leaseUntil).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

/** What "Refund this payment" will send: captured minus anything already refunded. */
export function reviewRefundPaise(review: {
  captured_paise?: number | null;
  refunded_paise?: number | null;
}): number | null {
  const captured = Number(review.captured_paise ?? NaN);
  if (!Number.isFinite(captured) || captured <= 0) return null;
  const already = Number(review.refunded_paise ?? 0);
  return Math.max(captured - (Number.isFinite(already) ? already : 0), 0);
}

export const RESOLVE_NOTE_MIN = 3;

export function resolveNoteError(note: string | null | undefined): string | null {
  const n = (note ?? "").trim();
  if (n.length < RESOLVE_NOTE_MIN) return `Add a note (at least ${RESOLVE_NOTE_MIN} characters) saying how it was handled.`;
  if (n.length > 500) return "Keep the note under 500 characters.";
  return null;
}

/** "5 min", "3 h", "2 d" since `iso`. */
export function ageLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const minutes = Math.max(0, Math.floor((now.getTime() - t) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

// ---------------------------------------------------------------------------
// Ops cancel
// ---------------------------------------------------------------------------

const CONFIRMED_STATUSES = ["accepted", "confirmed", "assigned", "rider_assigned"];
const AFTER_PICKUP_STATUSES = ["picked_up", "in_transit", "delivered", "completed"];

/** public.order_is_confirmed: the backend's one "confirmed" rule. */
export function isOrderConfirmed(order: {
  status?: string | null;
  confirmed_at?: string | null;
  assigned_knight_id?: string | null;
}): boolean {
  return Boolean(
    order.confirmed_at ||
      order.assigned_knight_id ||
      CONFIRMED_STATUSES.includes(String(order.status ?? "").toLowerCase()),
  );
}

export type OpsCancelPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      paid: boolean;
      confirmed: boolean;
      /** What the customer gets back (100% of the booking before pickup). */
      refundPaise: number;
    };

/**
 * What a dashboard cancel does to an app order. Before pickup a paid order is
 * refunded in full by the DB worker, confirmed or not; nothing is kept.
 */
export function planOpsCancel(
  order: { status?: string | null; confirmed_at?: string | null; assigned_knight_id?: string | null },
  invoice: { payment_status?: string | null; total_amount?: number | null } | null,
): OpsCancelPlan {
  const status = String(order.status ?? "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return { ok: false, reason: "This app order was already cancelled." };
  if (AFTER_PICKUP_STATUSES.includes(status)) return { ok: false, reason: "Cannot cancel after pickup — contact support." };
  const paid = String(invoice?.payment_status ?? "").toLowerCase() === "paid";
  const refundPaise = paid ? Math.max(rupeesToPaise(invoice?.total_amount), 0) : 0;
  return { ok: true, paid, confirmed: isOrderConfirmed(order), refundPaise };
}

/** Confirm-dialog copy for the dashboard Cancel button. */
export function cancelConfirmMessage(plan: OpsCancelPlan): string {
  if (!plan.ok) return plan.reason;
  if (!plan.paid) return "Cancel this order? It isn't paid, so no money moves. The customer will no longer see it in the app.";
  return `Cancel this order? The customer is refunded ${formatPaise(plan.refundPaise)} in full, automatically, within a few minutes.`;
}

// ---------------------------------------------------------------------------
// AUTO_REFUND_MODE
// ---------------------------------------------------------------------------

export type AutoRefundMode = "live" | "dry_run" | "off";

export const AUTO_REFUND_MODES: { value: AutoRefundMode; label: string; description: string }[] = [
  {
    value: "live",
    label: "Live",
    description:
      "Lost payments found by the reconcile job are recorded and, if rule A or B applies, refunded through Razorpay.",
  },
  {
    value: "dry_run",
    label: "Dry run",
    description:
      "The reconcile job only records what it WOULD refund (the dry-run list below). Razorpay is never called.",
  },
  {
    value: "off",
    label: "Off",
    description: "The reconcile job records nothing it would refund and calls nothing (rows show as skipped).",
  },
];

export const AUTO_REFUND_MODE_SCOPE =
  "This switch gates only the reconcile job for lost payments. Rule A (not confirmed within 30 min), rule B (paid after cancel) and cancellations refund in every mode. Payment reviews are never automatic.";

export function isAutoRefundMode(v: unknown): v is AutoRefundMode {
  return v === "live" || v === "dry_run" || v === "off";
}

export function autoRefundModeLabel(v: string | null | undefined): string {
  return AUTO_REFUND_MODES.find((m) => m.value === v)?.label ?? (v ? String(v) : "—");
}

// ---------------------------------------------------------------------------
// ops-refund responses
// ---------------------------------------------------------------------------

export type OpsRefundError = { ok: false; code: string; message: string; status: number };

const FALLBACK_MESSAGES: Record<string, string> = {
  unauthorized: "The dashboard could not sign in to the refund service.",
  forbidden: "The dashboard is not allowed to issue refunds.",
  not_found: "Not found. Refresh and try again.",
  in_progress: "A refund of this payment is running. Try again in a few minutes.",
  razorpay_error: "Razorpay did not accept the refund. Try again shortly.",
  internal: "Something went wrong. Check the status before trying again.",
  unavailable: "The refund service is not available yet. Try again later.",
};

/**
 * Normalise an ops-refund reply. ops-refund always answers
 * { ok:false, code, message } with a message fit for ops; anything else
 * (old deployment, network) gets a safe generic message.
 */
export function readOpsRefundError(body: unknown, status: number): OpsRefundError {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const code = typeof b.code === "string" && b.code ? b.code : status === 404 ? "unavailable" : "internal";
  const message =
    typeof b.message === "string" && b.message.trim()
      ? b.message.trim()
      : FALLBACK_MESSAGES[code] ?? FALLBACK_MESSAGES.internal;
  return { ok: false, code, message, status: status >= 400 ? status : 500 };
}
