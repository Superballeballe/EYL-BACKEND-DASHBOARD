/**
 * Address text for app orders, matching the customer app (EYL-APP
 * src/utils/addressFormat.js): flat, floor and building first, e.g.
 * "Flat 402, 4th floor, Sai Krupa CHS, Kurla West, Mumbai".
 */
const UNIT_WORD = /^(flat|shop|office|unit|room|house|bungalow|villa|plot|apt|apartment|suite|gala|godown|warehouse)\b/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export function formatApartment(value: unknown): string {
  const v = text(value);
  if (!v) return "";
  return UNIT_WORD.test(v) ? v : `Flat ${v}`;
}

export function formatFloor(value: unknown): string {
  const v = text(value);
  if (!v) return "";
  if (/^(g|gf|ground|0)$/i.test(v)) return "Ground floor";
  if (/^\d+$/.test(v)) return `${ordinal(Number(v))} floor`;
  if (/floor/i.test(v)) return v;
  return `${v} floor`;
}

export function formatUnitDetails(stop: { apartment?: unknown; floor?: unknown; building?: unknown }): string {
  return [formatApartment(stop.apartment), formatFloor(stop.floor), text(stop.building)].filter(Boolean).join(", ");
}

/** Unit details, then the map line, then the company. */
export function composeAddressLine(stop: {
  line?: unknown;
  company?: unknown;
  apartment?: unknown;
  floor?: unknown;
  building?: unknown;
}): string {
  const base = text(stop.line);
  const unit = formatUnitDetails(stop);
  if (!base) return unit;
  let out = unit ? `${unit}, ${base}` : base;
  const company = text(stop.company);
  if (company && !base.toLowerCase().includes(company.toLowerCase())) out += ` · Company ${company}`;
  return out;
}
