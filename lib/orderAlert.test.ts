import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ORDER_ALERT_MIN_GAP_MS, isIncomingOrder, shouldChime } from "./orderAlert";

describe("isIncomingOrder", () => {
  it("rings for a new delivery synced from an app or WhatsApp order", () => {
    assert.equal(isIncomingOrder({ eventType: "INSERT", new: { app_order_id: "a1b2" } }), true);
  });

  it("stays quiet for deliveries the dashboard created or imported", () => {
    assert.equal(isIncomingOrder({ eventType: "INSERT", new: { app_order_id: null } }), false);
    assert.equal(isIncomingOrder({ eventType: "INSERT", new: {} }), false);
    assert.equal(isIncomingOrder({ eventType: "INSERT", new: { app_order_id: "" } }), false);
  });

  it("stays quiet when an existing order is updated or deleted", () => {
    assert.equal(isIncomingOrder({ eventType: "UPDATE", new: { app_order_id: "a1b2" } }), false);
    assert.equal(isIncomingOrder({ eventType: "DELETE", new: {} }), false);
  });
});

describe("shouldChime", () => {
  it("rings the first time", () => {
    assert.equal(shouldChime(null, 0), true);
  });

  it("holds back a second chime inside the gap", () => {
    assert.equal(shouldChime(1_000, 1_000 + ORDER_ALERT_MIN_GAP_MS - 1), false);
  });

  it("rings again once the gap has passed", () => {
    assert.equal(shouldChime(1_000, 1_000 + ORDER_ALERT_MIN_GAP_MS), true);
  });
});
