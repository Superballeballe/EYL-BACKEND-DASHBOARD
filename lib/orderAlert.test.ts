import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { incomingOrderId, settledOrderId } from "./orderAlert";

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
