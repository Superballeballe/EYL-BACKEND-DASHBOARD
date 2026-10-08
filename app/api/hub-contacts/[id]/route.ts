import { supabaseAdmin } from "@/lib/supabase/admin";
import { hubContactUpdateSchema } from "@/lib/schemas";
import { notFound, ok, parseBody, serverError } from "@/lib/api";
import { HUB_CONTACT_COLUMNS, hubContactWriteError } from "@/lib/server/hubContacts";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, hubContactUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("hub_contacts")
      .update(parsed.data)
      .eq("id", id)
      .select(HUB_CONTACT_COLUMNS)
      .maybeSingle();
    if (error) return hubContactWriteError(error) ?? serverError(error);
    if (!data) return notFound("Hub contact not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("hub_contacts")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Hub contact not found");
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
