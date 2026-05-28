import { supabaseAdmin } from "@/lib/supabase/admin";
import { knightUpdateSchema } from "@/lib/schemas";
import { invalidateRoster } from "@/lib/server/roster";
import { notFound, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("knights")
      .select("*, knight_salaries(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Knight not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, knightUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("knights")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Knight not found");
    invalidateRoster();
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin().from("knights").delete().eq("id", id);
    if (error) return serverError(error);
    invalidateRoster();
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
