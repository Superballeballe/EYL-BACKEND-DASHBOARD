type RefundNotes = Record<string, string>;

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) {
    throw new Error("Supabase is not configured for Razorpay refunds.");
  }

  const res = await fetch(`${url}/functions/v1/razorpay-refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      apikey: serviceRole,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_id: paymentId,
      amount_paise: amountPaise,
      idempotency_key: idempotencyKey,
      notes: notes ?? {},
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    refund_id?: string;
    already_refunded?: boolean;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(payload.error || `Razorpay refund failed (${res.status})`);
  }

  return {
    refundId: String(payload.refund_id || paymentId),
    alreadyRefunded: Boolean(payload.already_refunded),
  };
}
