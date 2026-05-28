import { supabaseAdmin } from "@/lib/supabase/admin";
import { lineupSchema } from "@/lib/schemas";
import { badRequest, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const date = new URL(req.url).searchParams.get("date");
    if (!date) return badRequest("Missing ?date=YYYY-MM-DD");
    const db = supabaseAdmin();
    const [{ data: workDay }, { data: assignments, error }] = await Promise.all([
      db.from("work_days").select("*").eq("work_date", date).maybeSingle(),
      db
        .from("daily_assignments")
        .select("*, knights(display_name, full_name)")
        .eq("work_date", date)
        .order("role")
        .order("position", { ascending: true, nullsFirst: false }),
    ]);
    if (error) return serverError(error);
    return ok({ work_day: workDay, assignments: assignments ?? [] });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, lineupSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { work_date, is_sunday, note } = parsed.data;
    const assignments = parsed.data.assignments ?? [];
    const db = supabaseAdmin();

    const workers = assignments.filter((a) => a.status === "working");
    const walker_count = workers.filter((a) => a.role === "walker").length;
    const biker_count = workers.filter((a) => a.role === "biker").length;

    const { error: wdErr } = await db
      .from("work_days")
      .upsert(
        { work_date, is_sunday: is_sunday ?? false, note, walker_count, biker_count },
        { onConflict: "work_date" },
      );
    if (wdErr) return serverError(wdErr);

    // Replace the day's assignments wholesale.
    const { error: delErr } = await db.from("daily_assignments").delete().eq("work_date", work_date);
    if (delErr) return serverError(delErr);

    if (assignments.length) {
      const rows = assignments.map((a, i) => ({
        ...a,
        work_date,
        position: a.position ?? i,
      }));
      const { error: insErr } = await db.from("daily_assignments").insert(rows);
      if (insErr) return serverError(insErr);
    }

    return ok({ ok: true, work_date, walker_count, biker_count });
  } catch (e) {
    return serverError(e);
  }
}
