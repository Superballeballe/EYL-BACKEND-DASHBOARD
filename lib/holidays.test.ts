import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, availability, formatDay, holidayDayError, istDayKey, nextOpenDay } from "./holidays";

// 8 Nov 2026, 11:30 PM IST; 9 Nov 9:00 AM IST.
const sunNight = new Date("2026-11-08T18:00:00Z");
const monMorning = new Date("2026-11-09T03:30:00Z");

describe("istDayKey", () => {
  it("switches day at midnight IST, not UTC", () => {
    assert.equal(istDayKey(new Date("2026-11-08T18:29:59Z")), "2026-11-08");
    assert.equal(istDayKey(new Date("2026-11-08T18:30:00Z")), "2026-11-09");
  });
});

describe("addDays / formatDay", () => {
  it("crosses month and year ends", () => {
    assert.equal(addDays("2026-11-30", 1), "2026-12-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
  it("formats a day key", () => {
    assert.equal(formatDay("2026-11-11"), "Wed 11 Nov");
  });
});

describe("holidayDayError", () => {
  it("accepts today and future days", () => {
    assert.equal(holidayDayError("2026-11-08", sunNight), null);
    assert.equal(holidayDayError("2026-11-09", sunNight), null);
  });
  it("refuses past days, typos and impossible dates", () => {
    assert.equal(holidayDayError("2026-11-07", sunNight), "That day has already passed.");
    assert.equal(holidayDayError("09-11-2026", sunNight), "Pick a valid date.");
    assert.equal(holidayDayError("2026-02-30", sunNight), "Pick a valid date.");
    assert.equal(holidayDayError("", sunNight), "Pick a valid date.");
  });
  it("refuses days beyond a year", () => {
    // 365 days after 8 Nov 2026 is 8 Nov 2027 (no 29 Feb in between).
    assert.equal(holidayDayError("2027-11-08", sunNight), null);
    assert.equal(holidayDayError("2027-11-09", sunNight), "Pick a day within the next year.");
  });
});

describe("availability", () => {
  const days = ["2026-11-09", "2026-11-10", "2026-11-01"];
  it("is open the evening before", () => {
    assert.deepEqual(availability(days, sunNight), {
      accepting: true,
      closed_today: false,
      closed_days: ["2026-11-09", "2026-11-10"],
      message: null,
    });
  });
  it("is closed on the day and names the next open day after a run", () => {
    assert.deepEqual(availability(days, monMorning), {
      accepting: false,
      closed_today: true,
      closed_days: ["2026-11-09", "2026-11-10"],
      message: "Not accepting orders today. Bookings open again Wed 11 Nov.",
    });
  });
  it("has nothing to say with no days", () => {
    assert.equal(availability([], monMorning).accepting, true);
  });
  it("finds no open day when everything is closed", () => {
    const all = Array.from({ length: 400 }, (_, i) => addDays("2026-11-09", i));
    assert.equal(nextOpenDay(all, monMorning), null);
    assert.equal(availability(all, monMorning).message, "Not accepting orders today.");
  });
});
