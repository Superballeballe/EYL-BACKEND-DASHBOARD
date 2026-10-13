import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appScheduleSlot, deliverySchedule } from "./deliverySchedule";

const SLOT = "Tue, 13 Oct · 11:00 AM – 2:00 PM";

describe("delivery schedule", () => {
  it("shows the app's slot at both pickup and drop", () => {
    const order = { app_order_id: "o1", pickup_time_window: SLOT, drop_time_window: "13 Oct 2026 · 12:30 PM" };
    assert.equal(appScheduleSlot(order), SLOT);
    assert.deepEqual(deliverySchedule(order), { pickup: SLOT, drop: SLOT });
  });

  it("keeps separate pickup and drop times for a manual booking", () => {
    const manual = { app_order_id: null, pickup_time_window: "2026-10-13T09:30", drop_time_window: "2026-10-13T11:00" };
    assert.equal(appScheduleSlot(manual), null);
    const schedule = deliverySchedule(manual);
    assert.match(schedule.pickup ?? "", /13 Oct/);
    assert.match(schedule.drop ?? "", /13 Oct/);
    assert.notEqual(schedule.pickup, schedule.drop);
  });

  it("treats an app order whose pickup was edited to an exact time like any other timed delivery", () => {
    const edited = { app_order_id: "o1", pickup_time_window: "2026-10-13T09:30", drop_time_window: null };
    assert.equal(appScheduleSlot(edited), null);
    assert.equal(deliverySchedule(edited).drop, null);
  });

  it("has nothing to show when no time was recorded", () => {
    assert.deepEqual(deliverySchedule({ app_order_id: "o1", pickup_time_window: "  ", drop_time_window: null }), {
      pickup: null,
      drop: null,
    });
    assert.deepEqual(deliverySchedule({ app_order_id: null, pickup_time_window: null, drop_time_window: "" }), {
      pickup: null,
      drop: null,
    });
  });
});
