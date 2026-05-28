import { supabaseAdmin } from "@/lib/supabase/admin";
import { salarySchema } from "@/lib/schemas";
import { created, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    let query = supabaseAdmin()
      .from("knight_salaries")
      .select("*, knights(display_name, full_name, role)")
      .order("month", { ascending: false });
    if (p.get("knight_id")) query = query.eq("knight_id", p.get("knight_id"));
    if (p.get("month")) query = query.eq("month", p.get("month"));
    const { data, error } = await query;
    if (error) return serverError(error);
    return ok({ data });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, salarySchema);
  if ("error" in parsed) return parsed.error;
  try {
    const row = {
      ...parsed.data,
      total: parsed.data.total ?? (parsed.data.travel ?? 0) + (parsed.data.salary ?? 0),
    };
    const { data, error } = await supabaseAdmin()
      .from("knight_salaries")
      .upsert(row, { onConflict: "knight_id,month" })
      .select()
      .single();
    if (error) return serverError(error);
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
