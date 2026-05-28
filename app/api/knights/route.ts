import { supabaseAdmin } from "@/lib/supabase/admin";
import { knightSchema } from "@/lib/schemas";
import { invalidateRoster } from "@/lib/server/roster";
import { created, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    let query = supabaseAdmin().from("knights").select("*").order("display_name");
    if (p.get("active") === "true") query = query.eq("active", true);
    if (p.get("role")) query = query.eq("role", p.get("role"));
    const { data, error } = await query;
    if (error) return serverError(error);
    return ok({ data });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, knightSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { data, error } = await supabaseAdmin()
      .from("knights")
      .insert(parsed.data)
      .select()
      .single();
    if (error) return serverError(error);
    invalidateRoster();
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
