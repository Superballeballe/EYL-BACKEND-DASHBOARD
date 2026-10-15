import {
  buildRefundRows,
  effectiveAutoRefundMode,
  modeHistoryFromAudit,
  type AutoRefundMode,
  type ModeHistoryEntry,
  type RefundListRow,
} from "@/lib/refunds";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CancelledOrder, PaymentRefund, PaymentReview } from "@/lib/types";
import type { LedgerExtra } from "@/lib/paymentLedger";

/**
 * Server-only reads for the Refunds page. Read only: nothing here sends or
 * records a refund. A table that is not there yet (backend migrations not
 * applied) reads as empty and is reported in `missing`.
 */
type Db = ReturnType<typeof supabaseAdmin>;

async function safeRows<T>(
  label: string,
  missing: string[],
  query: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.error(`[refunds-data] ${label} failed`, error.code, error.message);
    missing.push(label);
    return [];
  }
  return (data ?? []) as T[];
}

export async function countOpenPaymentReviews(db: Db = supabaseAdmin()): Promise<number> {
  const { count, error } = await db
    .from("payment_reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (error) {
    console.error("[refunds-data] count reviews failed", error.code, error.message);
    return 0;
  }
  return count ?? 0;
}

export type RefundsPageData = {
  refunds: RefundListRow[];
  openReviews: PaymentReview[];
  closedReviews: PaymentReview[];
  mode: AutoRefundMode;
  modeRaw: string | null;
  modeUpdatedAt: string | null;
  modeUpdatedBy: string | null;
  modeHistory: ModeHistoryEntry[];
  dryRunRows: PaymentRefund[];
  missing: string[];
};

export async function loadRefundsPageData(): Promise<RefundsPageData> {
  const db = supabaseAdmin();
  const missing: string[] = [];

  const [cancelled, ledger, reviews, settings, audit] = await Promise.all([
    safeRows<CancelledOrder>(
      "cancelled_orders",
      missing,
      db
        .from("cancelled_orders")
        .select("*")
        .neq("refund_status", "none")
        .order("cancelled_at", { ascending: false })
        .limit(300),
    ),
    safeRows<PaymentRefund>(
      "payment_refunds",
      missing,
      db.from("payment_refunds").select("*").order("created_at", { ascending: false }).limit(500),
    ),
    safeRows<PaymentReview>(
      "payment_reviews",
      missing,
      db.from("payment_reviews").select("*").order("created_at", { ascending: false }).limit(300),
    ),
    safeRows<{ value: string; updated_at: string | null; updated_by: string | null }>(
      "app_settings",
      missing,
      db.from("app_settings").select("value, updated_at, updated_by").eq("key", "auto_refund_mode").limit(1),
    ),
    safeRows<{ created_at: string; actor: string; result: string | null; detail: unknown }>(
      "refund_audit_log",
      missing,
      db
        .from("refund_audit_log")
        .select("created_at, actor, result, detail")
        .eq("action", "set_auto_refund_mode")
        .order("created_at", { ascending: false })
        .limit(50),
    ),
  ]);

  // Order codes for ledger-only rows (dry run / skipped have no cancelled row).
  const ledgerOrderIds = [
    ...new Set(ledger.filter((l) => l.status !== "claimed" && l.order_id).map((l) => l.order_id as string)),
  ];
  const orderCodes: Record<string, string | null> = {};
  if (ledgerOrderIds.length) {
    const rows = await safeRows<{ id: string; order_code: string | null }>(
      "orders",
      missing,
      db.from("orders").select("id, order_code").in("id", ledgerOrderIds.slice(0, 300)),
    );
    for (const r of rows) orderCodes[r.id] = r.order_code;
  }

  const setting = settings[0] ?? null;
  return {
    refunds: buildRefundRows(cancelled, ledger, orderCodes),
    openReviews: reviews.filter((r) => r.status === "open"),
    closedReviews: reviews.filter((r) => r.status !== "open"),
    mode: effectiveAutoRefundMode(setting?.value),
    modeRaw: setting?.value ?? null,
    modeUpdatedAt: setting?.updated_at ?? null,
    modeUpdatedBy: setting?.updated_by ?? null,
    modeHistory: modeHistoryFromAudit(audit),
    dryRunRows: ledger.filter((l) => l.status === "dry_run"),
    missing,
  };
}

export type OrderRefundData = {
  order: { id: string; order_code: string | null; status: string | null; confirmed_at: string | null } | null;
  invoice: { payment_status: string | null; total_amount: number | null; provider_ref: string | null; paid_at: string | null } | null;
  cancelled: CancelledOrder | null;
  /** Address-change difference payments applied to the order (order_payments). */
  extras: LedgerExtra[];
  ledger: PaymentRefund[];
  reviews: PaymentReview[];
};

export async function loadOrderRefund(orderId: string): Promise<OrderRefundData> {
  const db = supabaseAdmin();
  const missing: string[] = [];
  const [order, invoice, cancelled, ledger, reviews, extras] = await Promise.all([
    safeRows<OrderRefundData["order"] & object>(
      "orders",
      missing,
      db.from("orders").select("id, order_code, status, confirmed_at").eq("id", orderId).limit(1),
    ),
    safeRows<OrderRefundData["invoice"] & object>(
      "invoices",
      missing,
      db.from("invoices").select("payment_status, total_amount, provider_ref, paid_at").eq("order_id", orderId).limit(1),
    ),
    safeRows<CancelledOrder>("cancelled_orders", missing, db.from("cancelled_orders").select("*").eq("order_id", orderId).limit(1)),
    safeRows<PaymentRefund>(
      "payment_refunds",
      missing,
      db.from("payment_refunds").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ),
    safeRows<PaymentReview>(
      "payment_reviews",
      missing,
      db.from("payment_reviews").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    ),
    safeRows<LedgerExtra>(
      "order_payments",
      missing,
      db.from("order_payments").select("provider_ref, amount, created_at, purpose").eq("order_id", orderId).order("created_at"),
    ),
  ]);
  return {
    order: order[0] ?? null,
    invoice: invoice[0] ?? null,
    cancelled: cancelled[0] ?? null,
    extras,
    ledger,
    reviews,
  };
}
