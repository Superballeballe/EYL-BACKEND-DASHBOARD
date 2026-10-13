import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeAddressLine, formatApartment, formatFloor } from "./addressFormat";
import { getDeliveryStops } from "./deliveryRouteDetails";

describe("app order address text", () => {
  it("leads with flat, floor and building (same strings as the customer app)", () => {
    assert.equal(
      composeAddressLine({ line: "Bandra West, Mumbai", apartment: "402", floor: "4", building: "Sai Krupa CHS" }),
      "Flat 402, 4th floor, Sai Krupa CHS, Bandra West, Mumbai",
    );
    assert.equal(
      composeAddressLine({ line: "Bandra West, Mumbai", apartment: "Shop 3", floor: "G", building: "Gupta Market" }),
      "Shop 3, Ground floor, Gupta Market, Bandra West, Mumbai",
    );
    assert.equal(formatFloor("11"), "11th floor");
    assert.equal(formatFloor("23"), "23rd floor");
    assert.equal(formatApartment("A-402"), "Flat A-402");
    assert.equal(composeAddressLine({}), "");
  });

  it("shows each stop's unit details on the dashboard", () => {
    const stops = getDeliveryStops({
      raw: null,
      drop_location: "Shop 3, Ground floor, Gupta Market, Bandra West, Mumbai",
      drop_recipient_name: "Asha",
      recipient_phone: "9876543210",
      app_order: {
        invoices: [{
          metadata: {
            stops: [
              { line: "Bandra West, Mumbai", apartment: "Shop 3", floor: "G", building: "Gupta Market", contactName: "Asha" },
              { line: "Andheri East, Mumbai", apartment: "B-7", floor: "12", building: "Tower One", contactName: "Ravi" },
            ],
          },
        }],
      },
    } as unknown as Parameters<typeof getDeliveryStops>[0]);
    assert.deepEqual(stops.map((s) => s.location), [
      "Shop 3, Ground floor, Gupta Market, Bandra West, Mumbai",
      "Flat B-7, 12th floor, Tower One, Andheri East, Mumbai",
    ]);
  });

  it("keeps old stops (no unit details) as they are", () => {
    const stops = getDeliveryStops({
      raw: null,
      drop_location: null,
      drop_recipient_name: null,
      recipient_phone: null,
      app_order: { invoices: [{ metadata: { stops: [{ line: "Bandra West · Sea View · Floor 8" }] } }] },
    } as unknown as Parameters<typeof getDeliveryStops>[0]);
    assert.equal(stops[0].location, "Bandra West · Sea View · Floor 8");
  });
});
