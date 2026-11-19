import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appScheduleSlot, appSlotMinutes, bookedAt, deliverySchedule } from "./deliverySchedule";
import { fmtDatetimeLocal } from "./format";

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

  it("falls back to the app order's own times when the delivery never got any", () => {
    const booked = {
      app_order_id: "o1",
      pickup_time_window: null,
      drop_time_window: null,
      app_order: {
        scheduled_for: "2026-11-19T08:00:00+00:00",
        pickup_scheduled_at: "2026-11-19T08:00:00+00:00",
        delivery_scheduled_at: "2026-11-19T09:30:00+00:00",
      },
    };
    const schedule = deliverySchedule(booked);
    assert.equal(schedule.pickup, fmtDatetimeLocal("2026-11-19T08:00:00+00:00"));
    assert.equal(schedule.drop, fmtDatetimeLocal("2026-11-19T09:30:00+00:00"));
    assert.notEqual(schedule.pickup, schedule.drop);
  });

  it("uses scheduled_for as the pickup when the order has no separate pickup time", () => {
    const schedule = deliverySchedule({
      app_order_id: "o1",
      pickup_time_window: null,
      drop_time_window: null,
      app_order: { scheduled_for: "2026-11-19T08:00:00+00:00", pickup_scheduled_at: null, delivery_scheduled_at: null },
    });
    assert.equal(schedule.pickup, fmtDatetimeLocal("2026-11-19T08:00:00+00:00"));
    assert.equal(schedule.drop, null);
  });

  it("shows the booked 30-minute pickup slot, and no drop until ops set one", () => {
    const schedule = deliverySchedule({
      app_order_id: "o1",
      pickup_time_window: null,
      drop_time_window: null,
      app_order: {
        pickup_scheduled_at: "2026-11-19T08:00:00+00:00",
        delivery_scheduled_at: null,
        invoices: { metadata: { schedule: { label: "Today · 1:30 PM – 2:00 PM", windowMinutes: 30 } } },
      },
    });
    assert.equal(schedule.pickup, `${fmtDatetimeLocal("2026-11-19T08:00:00+00:00")} – 02:00 pm`);
    assert.equal(schedule.drop, null);
  });

  it("reads the slot length from the first invoice when there are several", () => {
    assert.equal(appSlotMinutes({ invoices: [{ metadata: { schedule: { windowMinutes: 30 } } }, { metadata: null }] }), 30);
  });

  it("has no slot length when the app did not store a usable one", () => {
    assert.equal(appSlotMinutes(null), null);
    assert.equal(appSlotMinutes({ invoices: null }), null);
    assert.equal(appSlotMinutes({ invoices: { metadata: {} } }), null);
    assert.equal(appSlotMinutes({ invoices: { metadata: { schedule: { windowMinutes: 0 } } } }), null);
    assert.equal(appSlotMinutes({ invoices: { metadata: { schedule: { windowMinutes: "soon" } } } }), null);
  });

  it("shows an exact pickup ops set, not the booked slot", () => {
    const schedule = deliverySchedule({
      app_order_id: "o1",
      pickup_time_window: "2026-11-19T15:00",
      drop_time_window: null,
      app_order: {
        pickup_scheduled_at: "2026-11-19T08:00:00+00:00",
        invoices: { metadata: { schedule: { windowMinutes: 30 } } },
      },
    });
    assert.equal(schedule.pickup, fmtDatetimeLocal("2026-11-19T15:00"));
  });

  it("prefers the delivery's own times over the app order's", () => {
    const schedule = deliverySchedule({
      app_order_id: "o1",
      pickup_time_window: "2026-11-19T15:00",
      drop_time_window: "2026-11-19T16:00",
      app_order: {
        pickup_scheduled_at: "2026-11-19T08:00:00+00:00",
        delivery_scheduled_at: "2026-11-19T09:30:00+00:00",
      },
    });
    assert.equal(schedule.pickup, fmtDatetimeLocal("2026-11-19T15:00"));
    assert.equal(schedule.drop, fmtDatetimeLocal("2026-11-19T16:00"));
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

  it("has nothing to show when the app order has no times either", () => {
    assert.deepEqual(
      deliverySchedule({
        app_order_id: "o1",
        pickup_time_window: null,
        drop_time_window: null,
        app_order: { scheduled_for: null, pickup_scheduled_at: " ", delivery_scheduled_at: null },
      }),
      { pickup: null, drop: null },
    );
  });
});

describe("booked at", () => {
  it("is when the customer placed the app order", () => {
    assert.equal(
      bookedAt({ created_at: "2026-11-19T05:05:22Z", app_order: { created_at: "2026-11-19T05:04:45Z" } }),
      "2026-11-19T05:04:45Z",
    );
  });

  it("is when the delivery was created for a dashboard booking or an order without its own time", () => {
    assert.equal(bookedAt({ created_at: "2026-11-19T05:05:22Z", app_order: null }), "2026-11-19T05:05:22Z");
    assert.equal(bookedAt({ created_at: "2026-11-19T05:05:22Z", app_order: { created_at: null } }), "2026-11-19T05:05:22Z");
  });
});
