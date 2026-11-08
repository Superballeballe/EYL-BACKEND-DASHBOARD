/**
 * Service holidays: whole days, in India Standard Time, when EYL takes no orders.
 * Days are 'YYYY-MM-DD' IST keys (public.service_holidays.day). The database refuses
 * bookings on them (EYL-APP 20261108120000); everything here is display and input rules.
 */

const DAY_MS = 86_400_000;
// IST is a fixed UTC+5:30 with no DST, so shifting by it gives the exact IST date.
const IST_OFFSET_MS = 5.5 * 3_600_000;
/** How far ahead a day can be closed, and how far to look for the next open day. */
export const HOLIDAY_HORIZON_DAYS = 365;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type Holiday = { day: string; note: string; created_by: string | null; created_at: string };

export type Availability = {
  accepting: boolean;
  closed_today: boolean;
  /** Upcoming closed days from today on, ascending. */
  closed_days: string[];
  /** Customer-facing, when closed today. */
  message: string | null;
};

/** The IST calendar day of an instant. */
export function istDayKey(date: Date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `key` moved by `days` calendar days. */
export function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "Wed 11 Nov" for a day key. */
export function formatDay(key: string): string {
  return new Date(`${key}T00:00:00Z`)
    .toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .replace(/,/g, "");
}

/** Why `day` can't be closed, or null. Today counts; past days and typos don't. */
export function holidayDayError(day: string, now: Date = new Date()): string | null {
  if (!DAY_KEY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || addDays(day, 0) !== day) {
    return "Pick a valid date.";
  }
  const today = istDayKey(now);
  if (day < today) return "That day has already passed.";
  if (day > addDays(today, HOLIDAY_HORIZON_DAYS)) return "Pick a day within the next year.";
  return null;
}

/** The first day from today on that isn't closed, or null if none within the horizon. */
export function nextOpenDay(closedDays: string[], now: Date = new Date()): string | null {
  const closed = new Set(closedDays);
  let day = istDayKey(now);
  for (let i = 0; i <= HOLIDAY_HORIZON_DAYS; i += 1) {
    if (!closed.has(day)) return day;
    day = addDays(day, 1);
  }
  return null;
}

/** What the app, WhatsApp bot and knight app are told. */
export function availability(closedDays: string[], now: Date = new Date()): Availability {
  const today = istDayKey(now);
  const upcoming = [...new Set(closedDays)].filter((d) => d >= today).sort();
  const closedToday = upcoming[0] === today;
  if (!closedToday) return { accepting: true, closed_today: false, closed_days: upcoming, message: null };
  const reopens = nextOpenDay(upcoming, now);
  return {
    accepting: false,
    closed_today: true,
    closed_days: upcoming,
    message: reopens
      ? `Not accepting orders today. Bookings open again ${formatDay(reopens)}.`
      : "Not accepting orders today.",
  };
}
