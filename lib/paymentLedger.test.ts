import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPaymentLedger } from "./paymentLedger";

// The E2E order APPEYL476949: booked for ₹99, then four paid address changes,
// plus one payment that went to review (E2E Bug 1).
const invoice = { payment_status: "paid", total_amount: 843, provider_ref: "pay_booking", paid_at: "2026-10-15T06:56:03Z" };
const extras = [
  { provider_ref: "pay_c2", amount: 181, created_at: "2026-10-15T07:06:40Z", purpose: "drop_change" },
  { provider_ref: "pay_c1", amount: 233, created_at: "2026-10-15T07:04:43Z", purpose: "drop_change" },
  { provider_ref: "pay_c3a", amount: 30, created_at: "2026-10-15T07:08:33Z", purpose: "drop_change" },
  { provider_ref: "pay_c3b", amount: 300, created_at: "2026-10-15T07:10:08Z", purpose: "drop_change" },
];
const reviews = [
  {
    razorpay_payment_id: "pay_review", captured_paise: 5600, captured_at: "2026-10-15T07:17:00Z",
    created_at: "2026-10-15T07:17:30Z", status: "open", detail: "Paid for an address change that was already superseded.",
  },
];

describe("buildPaymentLedger", () => {
  it("lists the booking and every difference payment in time order with a running total", () => {
    const l = buildPaymentLedger({ invoice, extras, reviews: [] });
    assert.deepEqual(l.rows.map((r) => [r.razorpayPaymentId, r.amountPaise, r.runningTotalPaise]), [
      ["pay_booking", 9900, 9900],
      ["pay_c1", 23300, 33200],
      ["pay_c2", 18100, 51300],
      ["pay_c3a", 3000, 54300],
      ["pay_c3b", 30000, 84300],
    ]);
    assert.equal(l.rows[0].kind, "booking");
    assert.ok(l.rows.slice(1).every((r) => r.kind === "address_change" && r.status === "applied"));
    assert.equal(l.totalPaise, 84300, "₹99 + ₹744 = ₹843");
    assert.equal(l.invoiceTotalPaise, 84300);
    assert.equal(l.balanced, true);
  });

  it("shows payments under review but does not count them", () => {
    const l = buildPaymentLedger({ invoice, extras, reviews });
    const review = l.rows.find((r) => r.razorpayPaymentId === "pay_review");
    assert.ok(review);
    assert.equal(review.kind, "review");
    assert.equal(review.status, "needs_review");
    assert.equal(review.counted, false);
    assert.equal(review.amountPaise, 5600);
    assert.equal(review.runningTotalPaise, null);
    assert.equal(l.totalPaise, 84300, "review money is not part of the order total");
    assert.equal(l.reviewPaise, 5600);
    assert.equal(l.balanced, true);
  });

  it("an unpaid booking counts nothing", () => {
    const l = buildPaymentLedger({
      invoice: { payment_status: "pending", total_amount: 99, provider_ref: null, paid_at: null },
      extras: [],
      reviews: [],
    });
    assert.equal(l.rows.length, 1);
    assert.equal(l.rows[0].counted, false);
    assert.equal(l.rows[0].status, "pending");
    assert.equal(l.totalPaise, 0);
  });

  it("flags a ledger that does not add up", () => {
    // Difference payments larger than the invoice total: the booking share would be negative.
    const l = buildPaymentLedger({ invoice: { ...invoice, total_amount: 500 }, extras, reviews: [] });
    assert.equal(l.balanced, false);
  });

  it("no invoice: empty ledger", () => {
    const l = buildPaymentLedger({ invoice: null, extras: [], reviews: [] });
    assert.deepEqual(l.rows, []);
    assert.equal(l.totalPaise, 0);
  });
});
