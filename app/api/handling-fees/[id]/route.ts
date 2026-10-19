import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { handlingFeeUpdateSchema } from "@/lib/schemas";
import { APP_HANDLING_FEE_CODES } from "@/lib/pricing/handlingFees";
import { notFound, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Edit one app handling fee; other pricing_surcharges rows are not reachable here. */
export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, handlingFeeUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return notFound("Handling fee not found");
    const { data, error } = await supabaseAdmin()
      .from("pricing_surcharges")
      .update(parsed.data)
      .eq("id", id)
      .in("code", APP_HANDLING_FEE_CODES)
      .select()
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Handling fee not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}
