import { ok, serverError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap change signal for polling: row count + latest update time, no row data. */
export async function GET() {
  try {
    const db = supabaseAdmin();
    const [{ count, error: countError }, { data: latest, error: latestError }] = await Promise.all([
      db.from("deliveries").select("id", { count: "exact", head: true }),
      db.from("deliveries").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (countError) return serverError(countError);
    if (latestError) return serverError(latestError);

    return ok({ signal: `${count ?? 0}:${latest?.updated_at ?? ""}` });
  } catch (e) {
    return serverError(e);
  }
}
