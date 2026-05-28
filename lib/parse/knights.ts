// Match a raw "knight" cell to a knight in the roster.
// The cell may be a short name ("vijay", "KARIM"), a combo ("Rohit/Sachin"),
// an external provider ("We fast", "uber", "porter", "rapido", "self"),
// or a cancellation marker.

import { cleanText, isCancelled, type CellValue } from "./normalize";

export const EXTERNAL_PROVIDERS = ["we fast", "wefast", "uber", "porter", "rapido", "self", "dunzo", "borzo"];

export type KnightMatch = {
  knight_id: string | null;
  knight_name: string | null;
  assignment_status: "assigned" | "cancelled";
};

// Common alias → canonical display name (lowercased) to improve matching.
const ALIASES: Record<string, string> = {
  uttkarsh: "utkarsh",
  uttkasrh: "utkarsh",
  utkarsh: "utkarsh",
  shalomon: "shalmon",
  shalmon: "shalmon",
  nabi: "nabi",
  prathmesh: "prathmesh",
  shridhar: "shridhar",
};

function canonical(token: string): string {
  const t = token.toLowerCase().trim();
  return ALIASES[t] ?? t;
}

/**
 * @param roster Map of lowercased display_name → knight id.
 */
export function matchKnight(raw: CellValue, roster: Map<string, string>): KnightMatch {
  const name = cleanText(raw);
  if (!name) return { knight_id: null, knight_name: null, assignment_status: "assigned" };
  if (isCancelled(name)) return { knight_id: null, knight_name: name, assignment_status: "cancelled" };

  // Use the first token of a combo like "Rohit/Sachin" for the primary match.
  const first = name.split(/[\/,&]| and /i)[0]?.trim() ?? name;
  const key = canonical(first);

  if (EXTERNAL_PROVIDERS.includes(key)) {
    return { knight_id: null, knight_name: name, assignment_status: "assigned" };
  }

  const id = roster.get(key) ?? roster.get(first.toLowerCase()) ?? null;
  return { knight_id: id, knight_name: name, assignment_status: "assigned" };
}

/** Build the roster lookup map from knight rows. */
export function buildRoster(
  knights: { id: string; display_name: string }[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const k of knights) {
    if (k.display_name) m.set(canonical(k.display_name), k.id);
  }
  return m;
}
