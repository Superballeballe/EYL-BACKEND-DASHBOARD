import { supabaseAdmin } from "@/lib/supabase/admin";
import { hubContactSchema } from "@/lib/schemas";
import { created, ok, parseBody, serverError } from "@/lib/api";
import { HUB_CONTACT_COLUMNS, hubContactWriteError } from "@/lib/server/hubContacts";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    let query = supabaseAdmin()
      .from("hub_contacts")
      .select(HUB_CONTACT_COLUMNS)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (p.get("active") === "true") query = query.eq("active", true);
    const { data, error } = await query;
    if (error) return serverError(error);
    return ok({ data });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, hubContactSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { data, error } = await supabaseAdmin()
      .from("hub_contacts")
      .insert(parsed.data)
      .select(HUB_CONTACT_COLUMNS)
      .single();
    if (error) return hubContactWriteError(error) ?? serverError(error);
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
