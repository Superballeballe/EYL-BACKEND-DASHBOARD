import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateTierSchema } from "@/lib/schemas";
import { created, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    let query = supabaseAdmin()
      .from("rate_tiers")
      .select("*")
      .order("provider")
      .order("min_km", { ascending: true, nullsFirst: true });
    if (p.get("provider")) query = query.eq("provider", p.get("provider"));
    if (p.get("current") === "true") query = query.eq("is_current", true);
    const { data, error } = await query;
    if (error) return serverError(error);
    return ok({ data });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, rateTierSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { data, error } = await supabaseAdmin()
      .from("rate_tiers")
      .insert(parsed.data)
      .select()
      .single();
    if (error) return serverError(error);
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
