export type SerialPrefix = "APPEYL" | "MANEYL";

/** App-linked or online → APPEYL; manual / B2B dashboard entry → MANEYL. */
export function serialPrefix(
  mode: "b2b" | "online" | null | undefined,
  appOrderId?: string | null,
): SerialPrefix {
  if (appOrderId) return "APPEYL";
  return mode === "online" ? "APPEYL" : "MANEYL";
}

export function formatSerialCode(
  mode: "b2b" | "online" | null | undefined,
  serialNo: number | null | undefined,
  appOrderId?: string | null,
): string {
  if (serialNo == null || !Number.isFinite(serialNo)) return "—";
  return `${serialPrefix(mode, appOrderId)}-${String(Math.round(serialNo)).padStart(2, "0")}`;
}

/** APPEYL-12 / MANEYL-5 / plain digits → serial number for search. */
export function parseSerialQuery(q: string): number | null {
  const trimmed = q.trim();
  const coded = trimmed.match(/^(?:APPEYL|MANEYL)-(\d+)$/i);
  if (coded) return Number(coded[1]);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return null;
}
