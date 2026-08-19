import { invokeRazorpayRefund, mockRefundId } from "@/lib/server/razorpayRefund";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RefundSource = "manual" | "auto" | "cron";

type InvoicePay = {
  provider: string | null;
  provider_ref: string | null;
  metadata: Record<string, unknown> | null;
};

export type RefundProcessResult = {
  id: string;
  ok: boolean;
  refund_id?: string;
  amount?: number;
  already?: boolean;
  error?: string;
};

function razorpayPaymentId(invoice: InvoicePay | null) {
  const meta = invoice?.metadata && typeof invoice.metadata === "object" ? invoice.metadata : {};
  const fromMeta = typeof meta.razorpay_payment_id === "string" ? meta.razorpay_payment_id : "";
  const ref = String(invoice?.provider_ref || fromMeta || "").trim();
  if (ref.startsWith("pay_")) return ref;
  const provider = String(invoice?.provider ?? "").toLowerCase();
  if (provider === "dev" || provider === "coupon" || ref === "dev-free") return "dev-free";
  return "";
}

async function logRefundEvent(input: {
  cancelledOrderId: string;
  orderId: string | null;
  orderCode: string | null;
  source: RefundSource;
  status: "success" | "failed" | "skipped";
  refundRef?: string | null;
  amount?: number | null;
  error?: string | null;
}) {
  const db = supabaseAdmin();
  await db.from("refund_events").insert({
    cancelled_order_id: input.cancelledOrderId,
    order_id: input.orderId,
    order_code: input.orderCode,
    source: input.source,
    status: input.status,
    refund_ref: input.refundRef ?? null,
    amount: input.amount ?? null,
    error: input.error ?? null,
  });
}

export async function processCancelledOrderRefund(
  id: string,
  source: RefundSource = "manual",
): Promise<RefundProcessResult> {
  const db = supabaseAdmin();
  const { data: row, error: rowError } = await db
    .from("cancelled_orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (rowError) return { id, ok: false, error: rowError.message };
  if (!row) return { id, ok: false, error: "Cancelled order not found" };

  if (row.refund_status === "refunded") {
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: row.order_id,
      orderCode: row.order_code,
      source,
      status: "skipped",
      refundRef: row.refund_ref,
      amount: row.refund_amount,
    });
    return { id, ok: true, already: true, refund_id: row.refund_ref ?? undefined, amount: row.refund_amount };
  }

  if (row.refund_status !== "pending" || !(Number(row.refund_amount) > 0)) {
    const msg = "No refund pending for this cancellation";
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: row.order_id,
      orderCode: row.order_code,
      source,
      status: "skipped",
      error: msg,
    });
    return { id, ok: false, error: msg };
  }

  if (!row.order_id) {
    const msg = "Original order is missing";
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: null,
      orderCode: row.order_code,
      source,
      status: "failed",
      amount: row.refund_amount,
      error: msg,
    });
    return { id, ok: false, error: msg };
  }

  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .select("provider, provider_ref, metadata")
    .eq("order_id", row.order_id)
    .maybeSingle();
  if (invoiceError) {
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: row.order_id,
      orderCode: row.order_code,
      source,
      status: "failed",
      amount: row.refund_amount,
      error: invoiceError.message,
    });
    return { id, ok: false, error: invoiceError.message };
  }

  const paymentId = razorpayPaymentId(invoice as InvoicePay | null);
  if (!paymentId) {
    const msg = "No payment on invoice";
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: row.order_id,
      orderCode: row.order_code,
      source,
      status: "failed",
      amount: row.refund_amount,
      error: msg,
    });
    return { id, ok: false, error: msg };
  }

  const paise = Math.round(Number(row.refund_amount) * 100);
  let refundId: string;
  try {
    if (paymentId === "dev-free" || !paymentId.startsWith("pay_")) {
      refundId = mockRefundId(id);
    } else {
      const refund = await invokeRazorpayRefund({
        paymentId,
        amountPaise: paise,
        idempotencyKey: id,
        notes: {
          cancelled_order_id: id,
          order_code: row.order_code || "",
          reason: row.reason_code || "",
        },
      });
      refundId = refund.refundId;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Refund failed";
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: row.order_id,
      orderCode: row.order_code,
      source,
      status: "failed",
      amount: row.refund_amount,
      error: msg,
    });
    return { id, ok: false, error: msg };
  }

  const stamp = new Date().toISOString();
  const { error: updateError } = await db
    .from("cancelled_orders")
    .update({
      refund_status: "refunded",
      refund_ref: refundId,
      refunded_at: stamp,
    })
    .eq("id", id)
    .eq("refund_status", "pending");
  if (updateError) {
    await logRefundEvent({
      cancelledOrderId: id,
      orderId: row.order_id,
      orderCode: row.order_code,
      source,
      status: "failed",
      amount: row.refund_amount,
      error: updateError.message,
    });
    return { id, ok: false, error: updateError.message };
  }

  const meta = invoice?.metadata && typeof invoice.metadata === "object" ? invoice.metadata : {};
  await db
    .from("invoices")
    .update({
      metadata: {
        ...meta,
        refund_status: "refunded",
        razorpay_refund_id: refundId,
        refunded_at: stamp,
      },
    })
    .eq("order_id", row.order_id);

  await logRefundEvent({
    cancelledOrderId: id,
    orderId: row.order_id,
    orderCode: row.order_code,
    source,
    status: "success",
    refundRef: refundId,
    amount: row.refund_amount,
  });

  return { id, ok: true, refund_id: refundId, amount: row.refund_amount };
}

export async function processPendingRefunds(opts: {
  source: RefundSource;
  limit?: number;
}) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("cancelled_orders")
    .select("id")
    .eq("refund_status", "pending")
    .gt("refund_amount", 0)
    .order("cancelled_at", { ascending: true })
    .limit(opts.limit ?? 20);
  if (error) throw error;

  const results: RefundProcessResult[] = [];
  for (const row of data ?? []) {
    results.push(await processCancelledOrderRefund(row.id, opts.source));
  }
  return results;
}
