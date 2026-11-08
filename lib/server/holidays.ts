import type { SupabaseClient } from "@supabase/supabase-js";
import { istDayKey, type Holiday } from "@/lib/holidays";

export const HOLIDAY_COLUMNS = "day, note, created_by, created_at";

/** Closed days from today (IST) on, ascending. Throws on a database error. */
export async function listUpcomingHolidays(db: Pick<SupabaseClient, "from">, now: Date = new Date()): Promise<Holiday[]> {
  const { data, error } = await db
    .from("service_holidays")
    .select(HOLIDAY_COLUMNS)
    .gte("day", istDayKey(now))
    .order("day", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Holiday[];
}
