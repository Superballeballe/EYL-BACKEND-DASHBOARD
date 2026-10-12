import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_ORDER_MESSAGES,
  appOrderStage,
  assignBlockedReason,
  confirmBlockedReason,
  friendlyOrderUpdateError,
  isInvoicePaidOrFree,
  isOrderGuardError,
  timeLeftLabel,
} from "./appOrderLifecycle";

const now = new Date("2026-10-12T10:00:00Z");
const later = "2026-10-12T12:00:00Z";
const earlier = "2026-10-12T09:00:00Z";
const paid = { payment_status: "paid", total_amount: 250 };
const unpaid = { payment_status: "pending", total_amount: 250 };
const free = { payment_status: "pending", total_amount: 0 };

describe("isInvoicePaidOrFree", () => {
  it("matches order_invoice_is_free", () => {
    assert.equal(isInvoicePaidOrFree(paid), true);
    assert.equal(isInvoicePaidOrFree(free), true);
    assert.equal(isInvoicePaidOrFree({ payment_status: "pending", total_amount: null }), true);
    assert.equal(isInvoicePaidOrFree(unpaid), false);
    assert.equal(isInvoicePaidOrFree(null), false);
    assert.equal(isInvoicePaidOrFree({ payment_status: "pending" }), false);
    assert.equal(isInvoicePaidOrFree({ payment_status: "failed", total_amount: 0 }), false);
  });
});

describe("confirm", () => {
  const order = { status: "placed", confirmed_at: null, confirm_deadline_at: later };

  it("allows a paid or ₹0 order before the deadline", () => {
    assert.equal(confirmBlockedReason(order, paid, now), null);
    assert.equal(confirmBlockedReason(order, free, now), null);
    assert.equal(confirmBlockedReason({ ...order, confirm_deadline_at: null }, paid, now), null);
    assert.equal(appOrderStage(order, paid, now), "ready_to_confirm");
  });

  it("waits for payment", () => {
    assert.equal(confirmBlockedReason(order, unpaid, now), APP_ORDER_MESSAGES.awaitingPayment);
    assert.equal(confirmBlockedReason(order, null, now), APP_ORDER_MESSAGES.awaitingPayment);
  });

  it("rejects past the confirm deadline (inclusive, like now() >= deadline)", () => {
    const closed = { ...order, confirm_deadline_at: earlier };
    assert.equal(confirmBlockedReason(closed, paid, now), APP_ORDER_MESSAGES.confirmWindowClosed);
    const atDeadline = { ...order, confirm_deadline_at: now.toISOString() };
    assert.equal(confirmBlockedReason(atDeadline, paid, now), APP_ORDER_MESSAGES.confirmWindowClosed);
  });

  it("rejects cancelled or already confirmed orders", () => {
    assert.equal(confirmBlockedReason({ ...order, status: "cancelled" }, paid, now), APP_ORDER_MESSAGES.cancelled);
    assert.equal(confirmBlockedReason({ ...order, status: "Canceled" }, paid, now), APP_ORDER_MESSAGES.cancelled);
    assert.equal(
      confirmBlockedReason({ ...order, confirmed_at: earlier }, paid, now),
      APP_ORDER_MESSAGES.alreadyConfirmed,
    );
  });
});

describe("assign", () => {
  const confirmed = { status: "accepted", confirmed_at: earlier, confirm_deadline_at: later };

  it("allows a confirmed, paid order", () => {
    assert.equal(assignBlockedReason(confirmed, paid, { setsAppKnight: true, now }), null);
    assert.equal(assignBlockedReason(confirmed, free, { setsAppKnight: true, now }), null);
  });

  it("needs confirm first, and payment before that", () => {
    const placed = { ...confirmed, status: "placed", confirmed_at: null };
    assert.equal(assignBlockedReason(placed, paid, { setsAppKnight: true, now }), APP_ORDER_MESSAGES.assignNeedsConfirm);
    assert.equal(assignBlockedReason(placed, unpaid, { setsAppKnight: true, now }), APP_ORDER_MESSAGES.assignNeedsPayment);
    assert.equal(assignBlockedReason(confirmed, unpaid, { setsAppKnight: true, now }), APP_ORDER_MESSAGES.assignNeedsPayment);
  });

  it("past the deadline only blocks when the update sets assigned_knight_id", () => {
    const late = { ...confirmed, confirm_deadline_at: earlier };
    assert.equal(assignBlockedReason(late, paid, { setsAppKnight: true, now }), APP_ORDER_MESSAGES.assignWindowClosed);
    assert.equal(assignBlockedReason(late, paid, { setsAppKnight: false, now }), null);
  });
});

describe("DB errors", () => {
  it("recognises guard errors and maps them to friendly copy", () => {
    const notPaid = { code: "P0001", message: "not allowed: order is not paid yet" };
    const closed = { code: "P0001", message: "not allowed: confirmation window has closed" };
    assert.equal(isOrderGuardError(notPaid), true);
    assert.equal(isOrderGuardError({ code: "42703", message: "column does not exist" }), false);
    assert.equal(friendlyOrderUpdateError(notPaid, "confirm"), APP_ORDER_MESSAGES.awaitingPayment);
    assert.equal(friendlyOrderUpdateError(closed, "confirm"), APP_ORDER_MESSAGES.confirmWindowClosed);
    assert.equal(friendlyOrderUpdateError(closed, "assign"), APP_ORDER_MESSAGES.assignWindowClosed);
    assert.equal(friendlyOrderUpdateError({ message: "boom" }, "confirm"), APP_ORDER_MESSAGES.saveFailed);
  });
});

describe("timeLeftLabel", () => {
  it("formats minutes and hours", () => {
    assert.equal(timeLeftLabel("2026-10-12T10:12:30Z", now), "12 min");
    assert.equal(timeLeftLabel("2026-10-12T11:05:00Z", now), "1 h 5 min");
    assert.equal(timeLeftLabel("2026-10-12T12:00:00Z", now), "2 h");
    assert.equal(timeLeftLabel("2026-10-12T10:00:20Z", now), "1 min");
    assert.equal(timeLeftLabel(earlier, now), null);
    assert.equal(timeLeftLabel(null, now), null);
  });
});
