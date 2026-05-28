import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientSchema } from "@/lib/schemas";
import { created, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    let query = supabaseAdmin().from("clients").select("*").order("client_name");
    const q = p.get("q");
    if (q) {
      const term = `%${q}%`;
      query = query.or(`client_name.ilike.${term},company_name.ilike.${term},gst_no.ilike.${term}`);
    }
    const { data, error } = await query;
    if (error) return serverError(error);
    return ok({ data });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, clientSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { data, error } = await supabaseAdmin()
      .from("clients")
      .insert(parsed.data)
      .select()
      .single();
    if (error) return serverError(error);
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
