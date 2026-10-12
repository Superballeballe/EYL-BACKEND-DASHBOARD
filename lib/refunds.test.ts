import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ageLabel,
  buildRefundRows,
  effectiveAutoRefundMode,
  manualRefundAction,
  modeChangeNote,
  modeHistoryFromAudit,
  modeReasonError,
  showDryRunList,
  cancelConfirmMessage,
  cancelledRefundPaise,
  friendlyOpsCancelError,
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

describe("cancelled refund amount", () => {
  it("prefers the paise column and falls back to rupees", () => {
    assert.equal(cancelledRefundPaise({ refund_amount_paise: 44950, refund_amount: 450 }), 44950);
    assert.equal(cancelledRefundPaise({ refund_amount: 300 }), 30000);
    assert.equal(cancelledRefundPaise({}), null);
  });

  it("labels ledger-only statuses", () => {
    assert.equal(refundStatusInfo("dry_run").label, "Dry run · not sent");
    assert.equal(refundStatusInfo("skipped").label, "Skipped · mode off");
  });
});

describe("ops cancel errors", () => {
  it("keeps the after-pickup copy", () => {
    assert.deepEqual(friendlyOpsCancelError("after_pickup", "x"), {
      status: 409,
      message: "Can't cancel after pickup — contact support.",
    });
    assert.equal(friendlyOpsCancelError(null, "Order has been picked up").status, 409);
  });

  it("maps already cancelled and not found", () => {
    assert.equal(friendlyOpsCancelError("already_cancelled", null).status, 409);
    assert.equal(friendlyOpsCancelError("not_found", null).status, 404);
  });

  it("shows an ops message for a known code but hides raw DB errors", () => {
    assert.deepEqual(friendlyOpsCancelError("forbidden", "Only ops can cancel."), { status: 400, message: "Only ops can cancel." });
    const raw = friendlyOpsCancelError(null, 'relation "x" does not exist');
    assert.equal(raw.status, 500);
    assert.doesNotMatch(raw.message, /relation/);
  });
});

describe("AUTO_REFUND_MODE", () => {
  it("treats a missing or unknown value as live", () => {
    assert.equal(effectiveAutoRefundMode(null), "live");
    assert.equal(effectiveAutoRefundMode("bogus"), "live");
    assert.equal(effectiveAutoRefundMode("dry_run"), "dry_run");
  });

  it("shows the dry-run list only in dry_run or while rows exist", () => {
    assert.equal(showDryRunList("live", 0), false);
    assert.equal(showDryRunList("live", 2), true);
    assert.equal(showDryRunList("dry_run", 0), true);
  });

  it("requires a reason and records the user in the note", () => {
    assert.ok(modeReasonError("ok"));
    assert.equal(modeReasonError("Razorpay outage"), null);
    assert.equal(modeChangeNote("a@b.c", " outage "), "a@b.c: outage");
  });

  it("reads history from the audit log", () => {
    const h = modeHistoryFromAudit([
      { created_at: "t2", actor: "service", result: "ok", detail: { from: "live", mode: "off", note: "a@b.c: x" } },
      { created_at: "t1", actor: "service", result: "error", detail: {} },
    ]);
    assert.deepEqual(h, [{ at: "t2", from: "live", to: "off", note: "a@b.c: x", actor: "service" }]);
  });
});

describe("refund list", () => {
  it("merges cancellation refunds and dry-run rows, newest first", () => {
    const rows = buildRefundRows(
      [
        { id: "c1", order_id: "o1", order_code: "EYL1", refund_status: "failed", refund_amount_paise: 30000,
          refund_last_error: "balance", cancelled_at: "2026-10-12T10:00:00Z", was_confirmed: true },
        { id: "c2", order_id: "o2", order_code: "EYL2", refund_status: "none", cancelled_at: "2026-10-12T11:00:00Z" },
      ],
      [
        { razorpay_payment_id: "pay_1", order_id: "o1", cancelled_order_id: "c1", origin: "confirmed_cancel",
          status: "claimed", amount_paise: 30000, note: null, created_at: "2026-10-12T10:00:00Z" },
        { razorpay_payment_id: "pay_9", order_id: "o9", cancelled_order_id: null, origin: "reconcile",
          status: "dry_run", amount_paise: 5000, note: "would refund", created_at: "2026-10-12T12:00:00Z" },
      ],
      { o9: "EYL9" },
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].status, "dry_run");
    assert.equal(rows[0].order_code, "EYL9");
    assert.equal(rows[1].payment_id, "pay_1");
    assert.equal(rows[1].origin, "confirmed_cancel");
    assert.equal(rows[1].last_error, "balance");
  });
});

describe("manual refund button", () => {
  it("only for failed refunds, picked-up orders and missed queues", () => {
    assert.equal(manualRefundAction({ orderStatus: "cancelled", paymentStatus: "paid", refundStatus: "failed" }), "retry");
    assert.equal(manualRefundAction({ orderStatus: "delivered", paymentStatus: "paid", refundStatus: null }), "refund_after_pickup");
    assert.equal(manualRefundAction({ orderStatus: "cancelled", paymentStatus: "paid", refundStatus: "pending" }), null);
    assert.equal(manualRefundAction({ orderStatus: "cancelled", paymentStatus: "paid", refundStatus: "refunded" }), null);
    assert.equal(manualRefundAction({ orderStatus: "accepted", paymentStatus: "paid", refundStatus: null }), null);
    assert.equal(manualRefundAction({ orderStatus: "delivered", paymentStatus: "pending", refundStatus: null }), null);
    assert.equal(manualRefundAction({ orderStatus: "cancelled", paymentStatus: "paid", refundStatus: "none" }), "start_refund");
  });
});
