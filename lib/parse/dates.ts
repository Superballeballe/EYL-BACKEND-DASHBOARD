// Date & time parsing for the messy manual-entry spreadsheet.
//
// Key realities handled here:
//  - Excel turned time text like "4 11" into real dates (2026-04-11). Those
//    land in TIME columns at midnight, so we reconstruct "M D" as the likely
//    original time text and flag the row for review.
//  - Booking dates appear as real dates, "dd-mm-yyyy" text, or "dd/mm/yy".
//  - For daily sheets, the reliable task date is the sheet NAME, not the cell.

import type { CellValue } from "./normalize";

const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Format a JS Date as YYYY-MM-DD using LOCAL components (matches Excel display). */
export function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Excel serial number → JS Date (UTC-safe), serial 0 = 1899-12-30. */
function serialToDate(serial: number): Date {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms);
}

/**
 * Parse a date cell to "YYYY-MM-DD" or null.
 * Accepts Date objects, Excel serials, ISO strings, and dd-mm-yyyy / dd/mm/yy.
 */
export function parseDateValue(v: CellValue): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return formatDateLocal(v);
  if (typeof v === "number") {
    if (v > 59 && v < 80000) return formatDateLocal(serialToDate(v));
    return null;
  }
  const s = String(v).trim();
  if (!s) return null;

  // ISO: 2026-05-02
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validCal(+m[1], +m[2], +m[3]);

  // dd-mm-yyyy / dd/mm/yyyy / dd.mm.yyyy  (Indian day-first order)
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    let year = +y;
    if (year < 100) year += 2000;
    return validCal(year, +mo, +d);
  }
  return null;
}

// Reject impossible calendar dates (e.g. 2026-04-31, 2026-02-30) the user
// occasionally types into the workbook — Postgres rejects them outright.
function validCal(y: number, mm: number, dd: number): string | null {
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(Date.UTC(y, mm - 1, dd));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return `${y}-${pad(mm)}-${pad(dd)}`;
}

/**
 * Parse a TIME column cell. Returns { value, recovered } where `recovered`
 * is true when we reconstructed a mangled date→time and the row should be
 * flagged for review.
 */
export function parseTimeCell(v: CellValue): { value: string | null; recovered: boolean } {
  if (v === null || v === undefined || v === "") return { value: null, recovered: false };

  if (v instanceof Date) {
    const h = v.getHours();
    const min = v.getMinutes();
    if (h === 0 && min === 0) {
      // Almost certainly a time like "4 11" that Excel coerced into a date.
      const mon = v.getMonth() + 1;
      const day = v.getDate();
      return { value: `${mon} ${pad(day)}`, recovered: true };
    }
    return { value: `${pad(h)}:${pad(min)}`, recovered: false };
  }

  if (typeof v === "number") {
    if (v >= 0 && v < 1) {
      const mins = Math.round(v * 1440);
      return { value: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`, recovered: false };
    }
    return { value: String(v), recovered: false };
  }

  return { value: String(v).replace(/\s+/g, " ").trim() || null, recovered: false };
}

/**
 * Derive the working date (and Sunday flag) from a daily sheet name like
 * "02-May", "07-May ", "17-May ( Sunady)", "11-Jan Sunday".
 */
export function parseSheetDate(
  sheetName: string,
  year = 2026,
): { date: string; isSunday: boolean } | null {
  const m = sheetName.trim().match(/^(\d{1,2})\s*[-\s]\s*([A-Za-z]{3,})/);
  if (!m) return null;
  const day = +m[1];
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!mon || day < 1 || day > 31) return null;
  const isSunday = /sun\s*d?ay|sunady/i.test(sheetName);
  return { date: `${year}-${pad(mon)}-${pad(day)}`, isSunday };
}
