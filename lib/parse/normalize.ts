// String / value normalization shared by the importer and the API.

export type CellValue = string | number | boolean | Date | null | undefined;

/** Trim a value to a clean string, or null if empty. */
export function cleanText(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return null; // dates handled by the date parsers
  const s = String(v).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

/** Normalize a header label: lowercase, punctuation → spaces, collapse. */
export function normHeader(v: CellValue): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Parse a possibly-messy numeric cell (handles "₹ 1,234.50", " 250 ", etc.). */
export function toNumber(v: CellValue): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  const s = String(v).replace(/[₹,\s]/g, "").replace(/rs\.?/i, "");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** mode_of_booking → 'b2b' | 'online' | null. */
export function normalizeMode(v: CellValue): "b2b" | "online" | null {
  const s = cleanText(v)?.toLowerCase();
  if (!s) return null;
  if (s.startsWith("b2b")) return "b2b";
  if (s.startsWith("on")) return "online"; // online / onine / onlin
  return null;
}

/** payment_status → 'paid' | 'unpaid' | 'free' | 'partial' | null. */
export function normalizePaymentStatus(v: CellValue): "paid" | "unpaid" | "free" | "partial" | null {
  const s = cleanText(v)?.toLowerCase();
  if (!s) return null;
  if (s.includes("free")) return "free";
  if (s.includes("partial")) return "partial";
  if (s.startsWith("unpaid") || s.startsWith("un paid")) return "unpaid";
  if (s.startsWith("pa")) return "paid"; // paid / paud / paId / pais
  return null;
}

/** payment_mode → keep free text but canonicalize the common ones. */
export function normalizePaymentMode(v: CellValue): string | null {
  const s = cleanText(v);
  if (!s) return null;
  const l = s.toLowerCase();
  if (l === "cash") return "cash";
  if (l === "upi" || l.includes("gpay") || l.includes("g pay") || l.includes("phonepe")) return "upi";
  if (l.includes("monthly")) return "monthly_billing";
  return s;
}

/** assignment_status helper for free-text knight cells. */
export function isCancelled(v: CellValue): boolean {
  const s = cleanText(v)?.toLowerCase();
  return !!s && s.includes("cancel");
}
