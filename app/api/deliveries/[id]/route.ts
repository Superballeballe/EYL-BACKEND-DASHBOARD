import { supabaseAdmin } from "@/lib/supabase/admin";
import { deliveryUpdateSchema } from "@/lib/schemas";
import { resolveKnight } from "@/lib/server/roster";
import { badRequest, forbidden, notFound, ok, parseBody, serverError, unauthorized } from "@/lib/api";
import { requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("deliveries")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Delivery not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, deliveryUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    const row = await resolveKnight(parsed.data);
    const { data, error } = await supabaseAdmin()
      .from("deliveries")
      .update(row)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Delivery not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { error } = await supabaseAdmin().from("deliveries").delete().eq("id", id);
    if (error) return serverError(error);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Admin access required");
    return serverError(e);
  }
}
