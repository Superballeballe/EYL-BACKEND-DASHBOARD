import { supabaseAdmin } from "@/lib/supabase/admin";
import { eylKnightUpdateSchema } from "@/lib/schemas";
import { approveEylKnight, deleteEylKnight, rejectEylKnight } from "@/lib/server/eylKnights";
import { notFound, ok, parseBody, serverError } from "@/lib/api";
import type { EylKnight } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { data, error } = await supabaseAdmin()
      .from("eyl_knights")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Applicant not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, eylKnightUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    const { data: applicant, error: loadError } = await supabaseAdmin()
      .from("eyl_knights")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadError) return serverError(loadError);
    if (!applicant) return notFound("Applicant not found");

    const row = applicant as EylKnight;
    const note = parsed.data.review_note ?? null;

    if (parsed.data.status === "approved") {
      const data = await approveEylKnight(
        { ...row, knight_role: parsed.data.knight_role ?? row.knight_role },
        note,
      );
      return ok(data);
    }

    if (parsed.data.status === "rejected") {
      const data = await rejectEylKnight(id, note);
      return ok(data);
    }

    const patch: Record<string, unknown> = { ...parsed.data };
    const { data, error } = await supabaseAdmin()
      .from("eyl_knights")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Applicant not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const deleted = await deleteEylKnight(id);
    if (!deleted) return notFound("Applicant not found");
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
