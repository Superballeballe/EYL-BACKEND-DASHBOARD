import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ageLabel,
  cancelConfirmMessage,
  formatPaise,
  isAutoRefundMode,
  isLeaseActive,
  isOrderConfirmed,
  originOfCancellation,
  planOpsCancel,
  readOpsRefundError,
  refundOriginLabel,
  refundStatusInfo,
  resolveNoteError,
  reviewKindLabel,
  reviewRefundPaise,
} from "./refunds";

describe("formatPaise", () => {
  it("formats whole and fractional rupees", () => {
    assert.equal(formatPaise(30000), "₹300");
    assert.equal(formatPaise(123456), "₹1,234.56");
    assert.equal(formatPaise(null), "—");
  });
});

describe("refund status", () => {
  it("labels every cancelled_orders status and shows unknown raw", () => {
    assert.equal(refundStatusInfo("pending").label, "Queued");
    assert.equal(refundStatusInfo("processing").label, "Sent to Razorpay");
    assert.equal(refundStatusInfo("refunded").color, "success");
    assert.equal(refundStatusInfo("failed").color, "error");
    assert.equal(refundStatusInfo("none").label, "No refund");
    assert.equal(refundStatusInfo("weird").label, "weird");
  });

  it("names refund origins", () => {
    assert.equal(refundOriginLabel("rule_a_not_confirmed"), "Not confirmed within 30 min");
    assert.equal(refundOriginLabel("rule_b_paid_after_cancel"), "Paid after cancel");
    assert.equal(refundOriginLabel("ops"), "Ops");
    assert.equal(refundOriginLabel("new_thing"), "new_thing");
  });

  it("mirrors refund_origin_of", () => {
    assert.equal(originOfCancellation({ reason_note: "ops: a@b.c", was_confirmed: true }), "ops");
    assert.equal(originOfCancellation({ was_confirmed: true }), "confirmed_cancel");
    assert.equal(originOfCancellation({ reason_label: "Paid after cancellation" }), "rule_b_paid_after_cancel");
    assert.equal(originOfCancellation({ reason_code: "not_confirmed" }), "rule_a_not_confirmed");
    assert.equal(originOfCancellation({ reason_code: "changed_plans" }), "customer_cancel");
  });
});

describe("payment reviews", () => {
  it("labels kinds", () => {
    assert.equal(reviewKindLabel("wrong_amount"), "Wrong amount");
    assert.equal(reviewKindLabel("duplicate"), "Duplicate");
    assert.equal(reviewKindLabel("other"), "Other");
  });

  it("refunds captured minus already refunded", () => {
    assert.equal(reviewRefundPaise({ captured_paise: 30000 }), 30000);
    assert.equal(reviewRefundPaise({ captured_paise: 30000, refunded_paise: 10000 }), 20000);
    assert.equal(reviewRefundPaise({ captured_paise: null }), null);
  });

  it("requires a resolve note of 3+ characters", () => {
    assert.ok(resolveNoteError(""));
    assert.ok(resolveNoteError("  ab "));
    assert.equal(resolveNoteError("Refunded in Razorpay"), null);
  });

  it("detects a running refund lease", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    assert.equal(isLeaseActive("2026-10-12T10:04:00Z", now), true);
    assert.equal(isLeaseActive("2026-10-12T09:59:00Z", now), false);
    assert.equal(isLeaseActive(null, now), false);
  });

  it("formats age", () => {
    const now = new Date("2026-10-12T10:00:00Z");
    assert.equal(ageLabel("2026-10-12T09:55:00Z", now), "5 min");
    assert.equal(ageLabel("2026-10-12T07:00:00Z", now), "3 h");
    assert.equal(ageLabel("2026-10-09T10:00:00Z", now), "3 d");
  });
});

describe("ops cancel", () => {
  it("uses the backend confirmed rule (pending knight is not a confirmation)", () => {
    assert.equal(isOrderConfirmed({ status: "placed", confirmed_at: "2026-10-12T10:00:00Z" }), true);
    assert.equal(isOrderConfirmed({ status: "placed", assigned_knight_id: "k" }), true);
    assert.equal(isOrderConfirmed({ status: "rider_assigned" }), true);
    assert.equal(isOrderConfirmed({ status: "placed" }), false);
  });

  it("refunds a paid order in full before pickup, confirmed or not", () => {
    const paid = { payment_status: "paid", total_amount: 449.5 };
    const unconfirmed = planOpsCancel({ status: "placed" }, paid);
    const confirmed = planOpsCancel({ status: "accepted", confirmed_at: "x" }, paid);
    assert.deepEqual(unconfirmed, { ok: true, paid: true, confirmed: false, refundPaise: 44950 });
    assert.deepEqual(confirmed, { ok: true, paid: true, confirmed: true, refundPaise: 44950 });
    assert.match(cancelConfirmMessage(confirmed), /₹449\.50 in full/);
  });

  it("moves no money for an unpaid order", () => {
    const plan = planOpsCancel({ status: "placed" }, { payment_status: "pending", total_amount: 300 });
    assert.deepEqual(plan, { ok: true, paid: false, confirmed: false, refundPaise: 0 });
    assert.match(cancelConfirmMessage(plan), /no money moves/);
  });

  it("refuses after pickup or when already cancelled", () => {
    assert.equal(planOpsCancel({ status: "picked_up" }, null).ok, false);
    assert.equal(planOpsCancel({ status: "cancelled" }, null).ok, false);
  });
});

describe("ops-refund errors", () => {
  it("keeps the function's own message", () => {
    const e = readOpsRefundError({ ok: false, code: "already_refunding", message: "Owned by a cancellation." }, 409);
    assert.deepEqual(e, { ok: false, code: "already_refunding", message: "Owned by a cancellation.", status: 409 });
  });

  it("falls back to a safe message", () => {
    assert.equal(readOpsRefundError(null, 500).message, "Something went wrong. Check the status before trying again.");
    assert.equal(readOpsRefundError("<html>", 404).code, "unavailable");
  });

  it("validates modes", () => {
    assert.equal(isAutoRefundMode("dry_run"), true);
    assert.equal(isAutoRefundMode("LIVE"), false);
  });
});
