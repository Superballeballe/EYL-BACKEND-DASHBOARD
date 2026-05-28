import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateTierUpdateSchema } from "@/lib/schemas";
import { notFound, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, rateTierUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("rate_tiers")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Rate tier not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin().from("rate_tiers").delete().eq("id", id);
    if (error) return serverError(error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
