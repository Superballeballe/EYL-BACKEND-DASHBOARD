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
    case "dry_run":
      return { label: "Dry run · not sent", color: "warning" };
    case "skipped":
      return { label: "Skipped · mode off", color: "default" };
    default:
      return { label: String(status), color: "default" };
  }
}

/** What a cancelled_orders row refunds, in paise (exact column first, rupees as fallback). */
export function cancelledRefundPaise(row: {
  refund_amount_paise?: number | null;
  refund_amount?: number | null;
}): number | null {
  const exact = row.refund_amount_paise;
  if (exact !== null && exact !== undefined && Number.isFinite(Number(exact))) return Number(exact);
  if (row.refund_amount === null || row.refund_amount === undefined) return null;
  return rupeesToPaise(row.refund_amount);
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
  ops_cancel: "Cancelled by ops",
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
 * (e.g. before the 20261012150000 migration is applied). Mirrors 20261012190000.
 */
export function originOfCancellation(row: {
  reason_code?: string | null;
  reason_label?: string | null;
  reason_note?: string | null;
  was_confirmed?: boolean | null;
}): string {
  if ((row.reason_note ?? "").startsWith("ops:")) return "ops";
  if (row.reason_code === "ops_cancelled") return "ops_cancel";
  if (row.reason_label === "Paid after cancellation" || row.reason_label === "Paid after the payment window closed") {
    return "rule_b_paid_after_cancel";
  }
  if (row.reason_code === "not_confirmed") return "rule_a_not_confirmed";
  if (row.was_confirmed) return "confirmed_cancel";
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
  if (AFTER_PICKUP_STATUSES.includes(status)) return { ok: false, reason: "Can't cancel after pickup — contact support." };
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
    label: "Live (normal)",
    description:
      "The normal state. Lost payments found by the reconcile job are recorded and, when rule A or B applies, refunded through Razorpay.",
  },
  {
    value: "dry_run",
    label: "Dry run (temporary)",
    description:
      "Temporary safety switch. The reconcile job only records what it WOULD refund (the dry-run list). Razorpay is never called for those.",
  },
  {
    value: "off",
    label: "Off (temporary)",
    description:
      "Temporary safety switch. The reconcile job refunds nothing and calls nothing; those payments show as skipped.",
  },
];

export const AUTO_REFUND_MODE_SCOPE =
  "This switch gates only refunds the reconcile job would trigger for lost payments. Rule A (not confirmed within 30 min), rule B (paid after cancel) and cancellations before pickup refund in every mode. Payment reviews are never automatic.";

/** The mode in force: a missing or unknown app_settings value means live (the default). */
export function effectiveAutoRefundMode(value: string | null | undefined): AutoRefundMode {
  return isAutoRefundMode(value) ? value : "live";
}

/** Show the dry-run list only while it matters: in dry_run, or while dry_run rows exist. */
export function showDryRunList(mode: AutoRefundMode, dryRunRows: number): boolean {
  return mode === "dry_run" || dryRunRows > 0;
}

export const MODE_REASON_MIN = 5;

export function modeReasonError(reason: string | null | undefined): string | null {
  const r = (reason ?? "").trim();
  if (r.length < MODE_REASON_MIN) return `Say why (at least ${MODE_REASON_MIN} characters).`;
  if (r.length > 400) return "Keep the reason under 400 characters.";
  return null;
}

/**
 * ops_set_auto_refund_mode records the service role as actor, so the note
 * carries the signed-in user: "<email>: <reason>" (≤ 500 chars).
 */
export function modeChangeNote(actor: string, reason: string): string {
  return `${actor}: ${reason.trim()}`.slice(0, 500);
}

/** refund_audit_log rows for set_auto_refund_mode → history entries. */
export type ModeHistoryEntry = { at: string; from: string | null; to: string | null; note: string | null; actor: string };

export function modeHistoryFromAudit(
  rows: { created_at: string; actor: string; result?: string | null; detail: unknown }[],
): ModeHistoryEntry[] {
  return rows
    .filter((r) => r.result !== "error")
    .map((r) => {
      const d = (r.detail && typeof r.detail === "object" ? r.detail : {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" && v ? v : null);
      return { at: r.created_at, from: str(d.from), to: str(d.mode), note: str(d.note), actor: r.actor };
    });
}

// ---------------------------------------------------------------------------
// Unified refunds list (cancelled_orders + payment_refunds)
// ---------------------------------------------------------------------------

export type RefundListRow = {
  key: string;
  order_id: string | null;
  order_code: string | null;
  cancelled_id: string | null;
  payment_id: string | null;
  status: string;
  origin: string;
  reason: string | null;
  amount_paise: number | null;
  refund_ref: string | null;
  last_error: string | null;
  at: string;
};

type CancelledForList = {
  id: string;
  order_id: string | null;
  order_code: string | null;
  reason_code?: string | null;
  reason_label?: string | null;
  reason_note?: string | null;
  was_confirmed?: boolean | null;
  refund_status: string;
  refund_amount?: number | null;
  refund_amount_paise?: number | null;
  refund_ref?: string | null;
  refund_last_error?: string | null;
  payment_ref?: string | null;
  cancelled_at: string;
};

type LedgerForList = {
  razorpay_payment_id: string;
  order_id: string | null;
  cancelled_order_id: string | null;
  origin: string;
  status: string;
  amount_paise: number | null;
  note: string | null;
  created_at: string;
};

/**
 * One list for ops: every cancellation refund (status from cancelled_orders,
 * origin from the ledger when it has the row) plus the reconcile job's
 * dry_run / skipped "would refund" rows, newest first. Review refunds live
 * in the Needs review history instead.
 */
export function buildRefundRows(
  cancelled: CancelledForList[],
  ledger: LedgerForList[],
  orderCodes: Record<string, string | null> = {},
): RefundListRow[] {
  const ledgerByCancelled = new Map<string, LedgerForList>();
  for (const l of ledger) if (l.cancelled_order_id) ledgerByCancelled.set(l.cancelled_order_id, l);

  const rows: RefundListRow[] = cancelled
    .filter((c) => c.refund_status && c.refund_status !== "none")
    .map((c) => {
      const l = ledgerByCancelled.get(c.id);
      return {
        key: `c:${c.id}`,
        order_id: c.order_id,
        order_code: c.order_code,
        cancelled_id: c.id,
        payment_id: c.payment_ref ?? l?.razorpay_payment_id ?? null,
        status: c.refund_status,
        origin: l?.origin ?? originOfCancellation(c),
        reason: c.reason_label ?? null,
        amount_paise: cancelledRefundPaise(c),
        refund_ref: c.refund_ref ?? null,
        last_error: c.refund_status === "failed" ? (c.refund_last_error ?? null) : null,
        at: c.cancelled_at,
      };
    });

  for (const l of ledger) {
    if (l.status !== "dry_run" && l.status !== "skipped") continue;
    rows.push({
      key: `p:${l.razorpay_payment_id}`,
      order_id: l.order_id,
      order_code: l.order_id ? (orderCodes[l.order_id] ?? null) : null,
      cancelled_id: null,
      payment_id: l.razorpay_payment_id,
      status: l.status,
      origin: l.origin,
      reason: l.note,
      amount_paise: l.amount_paise,
      refund_ref: null,
      last_error: null,
      at: l.created_at,
    });
  }

  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

// ---------------------------------------------------------------------------
// Manual refund (order page)
// ---------------------------------------------------------------------------

const PICKED_UP = ["picked_up", "in_transit", "delivered", "completed"];

/**
 * The manual refund button exists only where nothing automatic will happen:
 * a failed cancellation refund (retry), a paid order after pickup, or a paid
 * cancelled order whose refund was never queued.
 * Everything else is refunded automatically.
 */
export function manualRefundAction(input: {
  orderStatus: string | null | undefined;
  paymentStatus: string | null | undefined;
  refundStatus: string | null | undefined;
}): "retry" | "refund_after_pickup" | "start_refund" | null {
  if (input.refundStatus === "failed") return "retry";
  if (input.refundStatus === "refunded" || input.refundStatus === "pending" || input.refundStatus === "processing") {
    return null;
  }
  const paid = String(input.paymentStatus ?? "").toLowerCase() === "paid";
  const status = String(input.orderStatus ?? "").toLowerCase();
  if (paid && PICKED_UP.includes(status)) return "refund_after_pickup";
  // A paid cancelled order with no refund queued: the queue step was missed
  // (e.g. the dashboard cancel's refund call failed). Let ops start it.
  if (paid && (status === "cancelled" || status === "canceled")) return "start_refund";
  return null;
}

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

// ---------------------------------------------------------------------------
// ops_cancel_order replies
// ---------------------------------------------------------------------------

export const OPS_CANCEL_MESSAGES = {
  afterPickup: "Can't cancel after pickup — contact support.",
  alreadyCancelled: "This app order was already cancelled.",
  notFound: "Linked app order not found",
  failed: "Couldn't cancel this order. Refresh and check its status before trying again.",
} as const;

/**
 * Map an ops_cancel_order { ok:false, code, message } (or a raw DB error) to
 * an HTTP status and copy fit for ops. Raw DB text is never shown.
 */
export function friendlyOpsCancelError(
  code: string | null | undefined,
  message: string | null | undefined,
): { status: 400 | 404 | 409 | 500; message: string } {
  const c = String(code ?? "").toLowerCase();
  const m = String(message ?? "");
  if (c === "after_pickup" || c === "picked_up" || /pick(ed)?[ _-]?up/i.test(m)) {
    return { status: 409, message: OPS_CANCEL_MESSAGES.afterPickup };
  }
  if (c === "already_cancelled" || /already cancel/i.test(m)) {
    return { status: 409, message: OPS_CANCEL_MESSAGES.alreadyCancelled };
  }
  if (c === "not_found" || /not found/i.test(m)) return { status: 404, message: OPS_CANCEL_MESSAGES.notFound };
  // Codes from ops_* functions carry a message written for ops.
  if (c && c !== "internal" && m.trim() && c !== "unknown") return { status: 400, message: m.trim() };
  return { status: 500, message: OPS_CANCEL_MESSAGES.failed };
}
