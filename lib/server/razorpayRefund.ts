import { supabaseAdmin } from "@/lib/supabase/admin";

type RefundNotes = Record<string, string>;

export function mockRefundId(idempotencyKey: string) {
  return idempotencyKey ? `dev-free-refund-${idempotencyKey}` : "dev-free-refund";
}

export async function invokeRazorpayRefund({
  paymentId,
  amountPaise,
  idempotencyKey,
  notes,
}: {
  paymentId: string;
  amountPaise: number;
  idempotencyKey: string;
  notes?: RefundNotes;
}) {
  const { data, error } = await supabaseAdmin().functions.invoke("razorpay-refund", {
    body: {
      payment_id: paymentId,
      amount_paise: amountPaise,
      idempotency_key: idempotencyKey,
      notes: notes ?? {},
    },
  });

  if (error) {
    throw new Error(error.message || "Razorpay refund failed");
  }

  const payload = (data ?? {}) as {
    refund_id?: string;
    already_refunded?: boolean;
    dev?: boolean;
    error?: string;
  };

  if (payload.error) {
    throw new Error(payload.error);
  }

  return {
    refundId: String(payload.refund_id || paymentId),
    alreadyRefunded: Boolean(payload.already_refunded),
    dev: Boolean(payload.dev),
  };
}
