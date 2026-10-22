import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDeliveryStops, getPickupContact, getPickupLocation } from "./deliveryRouteDetails";

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

describe("dashboard-entered pickup and drop details", () => {
  it("prefers the pickup contact typed on the dashboard over the app's and the sender", () => {
    assert.deepEqual(
      getPickupContact({
        sender_name: "Acme Traders",
        pickup_contact_name: " Ramesh ",
        pickup_contact_phone: "9820012345",
        raw: { pickup: { contact_name: "App Name", contact_phone: "9000000000" } },
      }),
      { name: "Ramesh", phone: "9820012345" },
    );
    assert.deepEqual(
      getPickupContact({ sender_name: "Acme Traders", pickup_contact_name: "", pickup_contact_phone: null, raw: null }),
      { name: "Acme Traders", phone: null },
    );
  });

  it("puts the flat before the pickup address, and leaves it alone without one", () => {
    assert.equal(getPickupLocation({ pickup_flat: "402", pickup_location: "Bandra West, Mumbai" }), "Flat 402, Bandra West, Mumbai");
    assert.equal(getPickupLocation({ pickup_flat: null, pickup_location: "Bandra West, Mumbai" }), "Bandra West, Mumbai");
    assert.equal(getPickupLocation({ pickup_flat: "  ", pickup_location: null }), null);
  });

  it("puts the flat before the drop address on a single-drop row", () => {
    const [stop] = getDeliveryStops({
      raw: null,
      app_order: null,
      drop_flat: "Shop 3",
      drop_location: "Andheri East, Mumbai",
      drop_recipient_name: "Riya",
      recipient_phone: "9876543210",
    });
    assert.equal(stop.location, "Shop 3, Andheri East, Mumbai");
    assert.equal(stop.contactName, "Riya");
  });
});
