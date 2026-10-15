// Every payment on an app order, for the order page (E2E Bug 5): the booking
// payment, each address-change difference payment (order_payments), and any
// captured payment that went to ops review instead (payment_reviews). Review
// money was never applied to the order, so it is listed but not counted.
//
// The booking payment's amount is the invoice total less the difference
// payments: the same rule the refund split uses (EYL-APP refunds.ts,
// manual_refund_after_pickup).

export type LedgerInvoice = {
  payment_status: string | null;
  total_amount: number | null;
  provider_ref: string | null;
  paid_at: string | null;
};
export type LedgerExtra = { provider_ref: string; amount: number; created_at: string; purpose: string | null };
export type LedgerReview = {
  razorpay_payment_id: string;
  captured_paise: number | null;
  captured_at: string | null;
  created_at: string;
  status: string | null;
  detail: string | null;
};

export type LedgerRow = {
  kind: "booking" | "address_change" | "review";
  razorpayPaymentId: string | null;
  amountPaise: number;
  status: "paid" | "pending" | "applied" | "needs_review" | "refunded" | "resolved" | (string & {});
  at: string | null;
  counted: boolean;
  /** Total counted so far, after this row; null for rows that are not counted. */
  runningTotalPaise: number | null;
  note: string | null;
};

export type PaymentLedger = {
  rows: LedgerRow[];
  /** Sum of counted rows: money applied to the order. */
  totalPaise: number;
  invoiceTotalPaise: number;
  /** Captured but under review / refunded / resolved: not part of the order. */
  reviewPaise: number;
  /** The counted rows add up to the invoice total and no share is negative. */
  balanced: boolean;
};

const paise = (rupees: number | null | undefined) => Math.round(Number(rupees ?? 0) * 100);
const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

export function buildPaymentLedger({
  invoice,
  extras,
  reviews,
}: {
  invoice: LedgerInvoice | null;
  extras: LedgerExtra[];
  reviews: LedgerReview[];
}): PaymentLedger {
  if (!invoice) return { rows: [], totalPaise: 0, invoiceTotalPaise: 0, reviewPaise: 0, balanced: true };

  const invoiceTotalPaise = paise(invoice.total_amount);
  const paid = ["paid", "refunded"].includes(String(invoice.payment_status));
  const sortedExtras = [...extras].sort((a, b) => time(a.created_at) - time(b.created_at));
  const extrasPaise = sortedExtras.reduce((s, e) => s + paise(e.amount), 0);
  const bookingPaise = invoiceTotalPaise - extrasPaise;

  const counted: Omit<LedgerRow, "runningTotalPaise">[] = [
    {
      kind: "booking",
      razorpayPaymentId: invoice.provider_ref,
      amountPaise: bookingPaise,
      status: paid ? "paid" : String(invoice.payment_status ?? "pending"),
      at: invoice.paid_at,
      counted: paid,
      note: "Booking",
    },
    ...sortedExtras.map((e) => ({
      kind: "address_change" as const,
      razorpayPaymentId: e.provider_ref,
      amountPaise: paise(e.amount),
      status: "applied",
      at: e.created_at,
      counted: true,
      note: "Address change difference",
    })),
  ];

  let running = 0;
  const rows: LedgerRow[] = counted.map((r) => {
    if (!r.counted) return { ...r, runningTotalPaise: null };
    running += r.amountPaise;
    return { ...r, runningTotalPaise: running };
  });

  const reviewRows: LedgerRow[] = reviews.map((r) => ({
    kind: "review",
    razorpayPaymentId: r.razorpay_payment_id,
    amountPaise: Number(r.captured_paise ?? 0),
    status: r.status === "open" ? "needs_review" : String(r.status ?? "needs_review"),
    at: r.captured_at ?? r.created_at,
    counted: false,
    runningTotalPaise: null,
    note: r.detail,
  }));

  const all = [...rows, ...reviewRows].sort((a, b) => time(a.at) - time(b.at));
  return {
    rows: all,
    totalPaise: running,
    invoiceTotalPaise,
    reviewPaise: reviewRows.reduce((s, r) => s + r.amountPaise, 0),
    balanced: bookingPaise >= 0 && (!paid || running === invoiceTotalPaise),
  };
}
