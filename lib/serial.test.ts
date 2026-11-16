import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDeliverySource } from "./serial";

describe("formatDeliverySource", () => {
  it("names an app order, and the delivery plan it is a day of", () => {
    assert.equal(formatDeliverySource({ app_order_id: "o1", app_order: { plan_code: null } }), "App");
    assert.equal(formatDeliverySource({ app_order_id: "o1", app_order: { plan_code: "PLN-0042" } }), "App · Plan PLN-0042");
    assert.equal(formatDeliverySource({ app_order_id: "o1", app_order: { plan_code: "  " } }), "App");
    assert.equal(formatDeliverySource({ mode_of_booking: "online", app_order_id: null }), "App");
  });

  it("calls everything typed into the dashboard manual", () => {
    assert.equal(formatDeliverySource({ mode_of_booking: "b2b", app_order_id: null }), "Manual");
    assert.equal(formatDeliverySource({}), "Manual");
  });
});
