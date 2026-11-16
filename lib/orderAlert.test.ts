import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alertKey, incomingOrderId, settledOrderId } from "./orderAlert";

describe("incomingOrderId", () => {
  it("rings for a new delivery synced from an app or WhatsApp order", () => {
    assert.equal(incomingOrderId({ eventType: "INSERT", new: { app_order_id: "a1b2" } }), "a1b2");
  });

  it("stays quiet for deliveries the dashboard created or imported", () => {
    assert.equal(incomingOrderId({ eventType: "INSERT", new: { app_order_id: null } }), null);
    assert.equal(incomingOrderId({ eventType: "INSERT", new: {} }), null);
    assert.equal(incomingOrderId({ eventType: "INSERT", new: { app_order_id: "" } }), null);
  });

  it("stays quiet when an existing order is updated or deleted", () => {
    assert.equal(incomingOrderId({ eventType: "UPDATE", new: { app_order_id: "a1b2" } }), null);
    assert.equal(incomingOrderId({ eventType: "DELETE", new: {} }), null);
  });
});

describe("alertKey", () => {
  it("rings a single booking under its own id, every time", () => {
    const rung = new Set<string>();
    assert.equal(alertKey("o1", null, rung), "o1");
    assert.equal(alertKey("o2", null, rung), "o2");
    assert.equal(rung.size, 0);
  });

  it("rings a delivery plan once, whichever of its days arrives first", () => {
    const rung = new Set<string>();
    assert.equal(alertKey("day1", "p1", rung), "plan:p1");
    assert.equal(alertKey("day2", "p1", rung), null);
    assert.equal(alertKey("day30", "p1", rung), null);
  });

  it("rings again for another plan, and for days added to a plan in a later stream", () => {
    const rung = new Set<string>(["p1"]);
    assert.equal(alertKey("x", "p2", rung), "plan:p2");
    assert.equal(alertKey("y", "p1", new Set()), "plan:p1");
  });
});

describe("settledOrderId", () => {
  const update = (order: Record<string, unknown>) => ({ eventType: "UPDATE", new: { id: "o1", ...order }, old: {} });

  it("stops the alert once ops confirm the order", () => {
    assert.equal(settledOrderId(update({ status: "accepted", confirmed_at: "2026-10-22T10:00:00Z" })), "o1");
  });

  it("stops it when a knight is assigned or the order is cancelled", () => {
    assert.equal(settledOrderId(update({ status: "placed", assigned_knight_id: "k1" })), "o1");
    assert.equal(settledOrderId(update({ status: "cancelled" })), "o1");
    assert.equal(settledOrderId(update({ status: "Canceled" })), "o1");
  });

  it("stops it when the order is deleted", () => {
    assert.equal(settledOrderId({ eventType: "DELETE", new: {}, old: { id: "o1" } }), "o1");
    assert.equal(settledOrderId({ eventType: "DELETE", new: {}, old: {} }), null);
  });

  it("keeps ringing for changes that leave the order unconfirmed, such as payment", () => {
    assert.equal(settledOrderId(update({ status: "placed", confirmed_at: null, assigned_knight_id: null })), null);
    assert.equal(settledOrderId({ eventType: "INSERT", new: { id: "o1", status: "placed" }, old: {} }), null);
    assert.equal(settledOrderId({ eventType: "UPDATE", new: { status: "accepted", confirmed_at: "x" }, old: {} }), null);
  });
});
