import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildRoster, matchKnight } from "@/lib/parse";

let cache: { map: Map<string, string>; at: number } | null = null;
const TTL_MS = 30_000;

/** Cached display_name → knight id lookup. */
export async function getRoster(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const { data } = await supabaseAdmin().from("knights").select("id, display_name");
  const map = buildRoster(data ?? []);
  cache = { map, at: Date.now() };
  return map;
}

export function invalidateRoster() {
  cache = null;
}

/**
 * If a delivery payload has a knight_name but no knight_id, try to resolve the
 * id from the roster. Also derives assignment_status from cancellation markers.
 */
export async function resolveKnight<
  T extends {
    knight_id?: string | null;
    knight_name?: string | null;
    assignment_status?: "assigned" | "cancelled";
  },
>(input: T): Promise<T> {
  if (input.knight_id || !input.knight_name) return input;
  const roster = await getRoster();
  const m = matchKnight(input.knight_name, roster);
  return {
    ...input,
    knight_id: m.knight_id,
    assignment_status: input.assignment_status ?? m.assignment_status,
  };
}
