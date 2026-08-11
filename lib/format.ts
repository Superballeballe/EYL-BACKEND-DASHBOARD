export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatBookingMode(mode: "b2b" | "online" | null | undefined): string {
  if (mode === "online") return "Online";
  if (mode === "b2b") return "Manual";
  return "—";
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function fmtShortDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}

export function fmtMonth(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/** Local-timezone today as YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function weekdayLong(iso: string): string {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "long" });
}

export function isSundayISO(iso: string): boolean {
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() === 0;
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function clockToMinutes(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const hm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const m = parseInt(hm[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
  }
  const compact = s.match(/^(\d{1,2})[-\s]?(\d{2,4})$/);
  if (compact) {
    const h = parseInt(compact[1], 10);
    let tail = compact[2];
    if (tail.length === 4) tail = tail.slice(0, 2);
    const m = parseInt(tail, 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h * 60 + m;
  }
  return null;
}

function datetimeToEpochMinutes(raw: string): number | null {
  const s = raw.trim();
  if (!s.includes("T")) return null;
  const d = new Date(s.length === 16 ? s : s);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime() / 60_000;
}

/** Business timezone for scheduled pickup/delivery times. */
export const BUSINESS_TZ = "Asia/Kolkata";

function wallClockInBusinessTz(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: BUSINESS_TZ,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parse `datetime-local` wall clock as an instant in BUSINESS_TZ. */
function businessWallClockToDate(value: string): Date | null {
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalize stored text/ISO to `datetime-local` value (`YYYY-MM-DDTHH:mm`). */
export function toDatetimeLocalValue(
  value: string | null | undefined,
  fallbackDate?: string | null,
): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;
  if (s.includes("T") || s.endsWith("Z")) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return wallClockInBusinessTz(d);
  }
  const hm = s.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  const date = fallbackDate?.match(/^\d{4}-\d{2}-\d{2}$/) ? fallbackDate : null;
  if (hm && date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    let hours = parseInt(hm[1], 10);
    const mins = hm[2];
    const ampm = hm[3]?.toLowerCase();
    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;
    return `${date}T${pad(hours)}:${mins}`;
  }
  const labelMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (labelMatch) {
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const [, dayStr, monthStr, hourStr, minStr, ampm] = labelMatch;
    const month = months[monthStr.slice(0, 3).toLowerCase()];
    if (month === undefined) return "";
    let hours = parseInt(hourStr, 10);
    const mins = minStr;
    if (ampm?.toLowerCase() === "pm" && hours < 12) hours += 12;
    if (ampm?.toLowerCase() === "am" && hours === 12) hours = 0;
    const year = fallbackDate?.match(/^(\d{4})/)?.[1] ?? String(new Date().getFullYear());
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(month + 1)}-${pad(parseInt(dayStr, 10))}T${pad(hours)}:${mins}`;
  }
  return "";
}

export function scheduleInputToDate(value: string | null | undefined): Date | null {
  const v = toDatetimeLocalValue(value);
  if (!v) return null;
  return businessWallClockToDate(v);
}

export function nowDatetimeLocalInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMilliseconds(0);
  return wallClockInBusinessTz(d);
}

export function isScheduleInputBeforeNow(value: string | null | undefined): boolean {
  const d = scheduleInputToDate(value);
  if (!d) return false;
  const now = new Date();
  now.setSeconds(0, 0);
  now.setMilliseconds(0);
  return d < now;
}

export function isScheduleInputBefore(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = scheduleInputToDate(a);
  const db = scheduleInputToDate(b);
  if (!da || !db) return false;
  return da < db;
}

export function scheduleInputToIso(value: string | null | undefined): string | null {
  const d = scheduleInputToDate(value);
  return d ? d.toISOString() : null;
}

/** Operational window for scheduled pickup/delivery times. */
export const WORK_DAY_START_TIME = "08:00";
export const WORK_DAY_END_TIME = "20:30";

export function workingHoursRangeLabel(): string {
  return "8:00 AM – 8:30 PM";
}

export function workingHoursError(): string {
  return `Time must be between ${workingHoursRangeLabel()}.`;
}

export function workDayStartInput(date?: string | null): string {
  const d = date?.match(/^\d{4}-\d{2}-\d{2}$/) ? date : todayISO();
  return `${d}T${WORK_DAY_START_TIME}`;
}

export function workDayEndInput(date?: string | null): string {
  const d = date?.match(/^\d{4}-\d{2}-\d{2}$/) ? date : todayISO();
  return `${d}T${WORK_DAY_END_TIME}`;
}

export function isWithinWorkingHours(value: string | null | undefined): boolean {
  const v = toDatetimeLocalValue(value);
  if (!v) return true;
  const time = v.slice(11, 16);
  return time >= WORK_DAY_START_TIME && time <= WORK_DAY_END_TIME;
}

export function fmtDatetimeLocal(s: string | null | undefined): string {
  const v = toDatetimeLocalValue(s);
  if (!v) return s?.trim() ? s : "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return s ?? "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** First area/neighbourhood from a full address — e.g. "Azad Nagar" from "Azad Nagar, Mumbai…". */
export function areaLabel(address: string | null | undefined): string {
  if (!address?.trim()) return "—";
  const first = address.split(",")[0]?.trim();
  return first || address.trim();
}

export function routeAreaLabel(
  pickup: string | null | undefined,
  drop: string | null | undefined,
): string {
  const from = areaLabel(pickup);
  const to = areaLabel(drop);
  if (from === "—" && to === "—") return "—";
  return `${from} → ${to}`;
}

/** Duration as H:MM from pickup/drop actual times (datetime-local or legacy clock). */
export function calcWorkingHours(
  pickup: string | null | undefined,
  drop: string | null | undefined,
): string | null {
  const start =
    datetimeToEpochMinutes(pickup ?? "") ??
    (() => {
      const mins = clockToMinutes(pickup ?? "");
      return mins == null ? null : mins;
    })();
  const end =
    datetimeToEpochMinutes(drop ?? "") ??
    (() => {
      const mins = clockToMinutes(drop ?? "");
      return mins == null ? null : mins;
    })();
  if (start == null || end == null || end < start) return null;
  const mins = Math.round(end - start);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}
