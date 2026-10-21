import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getPickupContact } from "./deliveryRouteDetails";

describe("pickup contact", () => {
  it("uses the app order's pickup contact name and phone", () => {
    assert.deepEqual(
      getPickupContact({
        sender_name: "Sachin",
        raw: { pickup: { contact_name: " Sachin K ", contact_phone: "9029714118", line: "Goregaon East" } },
      }),
      { name: "Sachin K", phone: "9029714118" },
    );
  });

  it("falls back to the sender when the pickup has no contact name", () => {
    assert.deepEqual(
      getPickupContact({ sender_name: "Asha", raw: { pickup: { contact_name: "  ", contact_phone: "9876543210" } } }),
      { name: "Asha", phone: "9876543210" },
    );
  });

  it("handles manual rows with no pickup in raw", () => {
    assert.deepEqual(getPickupContact({ sender_name: "Ravi", raw: { "Sender Name": "Ravi" } }), { name: "Ravi", phone: null });
    assert.deepEqual(getPickupContact({ sender_name: null, raw: null }), { name: null, phone: null });
  });
});
