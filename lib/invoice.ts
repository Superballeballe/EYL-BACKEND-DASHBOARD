/** EYLINV01, EYLINV02, … */
export function formatInvoiceNo(seq: number | null | undefined): string {
  if (seq == null || !Number.isFinite(seq) || seq < 1) return "—";
  return `EYLINV${String(Math.round(seq)).padStart(2, "0")}`;
}

export function parseInvoiceNo(value: string | null | undefined): number | null {
  const m = String(value ?? "").trim().match(/^EYLINV(\d+)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
