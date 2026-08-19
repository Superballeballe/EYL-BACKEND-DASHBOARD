import { badRequest, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { requireSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

type InvoicePay = {
  provider_ref: string | null;
  metadata: Record<string, unknown> | null;
};

function razorpayPaymentId(invoice: InvoicePay | null) {
  const meta = invoice?.metadata && typeof invoice.metadata === "object" ? invoice.metadata : {};
  const fromMeta = typeof meta.razorpay_payment_id === "string" ? meta.razorpay_payment_id : "";
  const ref = String(invoice?.provider_ref || fromMeta || "").trim();
  return ref.startsWith("pay_") ? ref : "";
}

function alreadyRefunded(message: string) {
  return /already refunded|fully refunded|refund has already been processed/i.test(message);
}

export async function POST(_req: Request, { params }: Ctx) {
  try {
    await requireSessionUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    return serverError(e);
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    return badRequest("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the dashboard env.");
  }

  try {
    const { id } = await params;
    const db = supabaseAdmin();
    const { data: row, error: rowError } = await db
      .from("cancelled_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (rowError) return serverError(rowError);
    if (!row) return notFound("Cancelled order not found");
    if (row.refund_status === "refunded") return ok({ ok: true, already: true, refund_id: row.refund_ref });
    if (row.refund_status !== "pending" || !(Number(row.refund_amount) > 0)) {
      return badRequest("This cancellation has no refund to send.");
    }
    if (!row.order_id) return badRequest("Original order is missing, so the Razorpay payment cannot be found.");

    const { data: invoice, error: invoiceError } = await db
      .from("invoices")
      .select("provider_ref, metadata")
      .eq("order_id", row.order_id)
      .maybeSingle();
    if (invoiceError) return serverError(invoiceError);

    const paymentId = razorpayPaymentId(invoice as InvoicePay | null);
    if (!paymentId) {
      return badRequest("No Razorpay payment is stored on this invoice, so the customer cannot be refunded from here.");
    }

    const paise = Math.round(Number(row.refund_amount) * 100);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzp = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "X-Razorpay-Idempotency-Key": id,
      },
      body: JSON.stringify({
        amount: paise,
        notes: {
          cancelled_order_id: id,
          order_code: row.order_code || "",
          reason: row.reason_code || "",
        },
      }),
    });
    const payload = (await rzp.json()) as {
      id?: string;
      error?: { description?: string };
    };
    const rzpError = String(payload?.error?.description || "");
    if (!rzp.ok && !alreadyRefunded(rzpError)) {
      return badRequest(rzpError || "Razorpay refund failed");
    }

    const refundId = payload.id || row.refund_ref || paymentId;
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
    if (updateError) return serverError(updateError);

    const meta = invoice?.metadata && typeof invoice.metadata === "object" ? invoice.metadata : {};
    const { error: invoiceUpdateError } = await db
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
    if (invoiceUpdateError) return serverError(invoiceUpdateError);

    return ok({ ok: true, refund_id: refundId, amount: row.refund_amount });
  } catch (e) {
    return serverError(e);
  }
}
