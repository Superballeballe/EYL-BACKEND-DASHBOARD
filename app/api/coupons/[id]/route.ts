import { supabaseAdmin } from "@/lib/supabase/admin";
import { monthlyCouponUpdateSchema } from "@/lib/schemas";
import { notFound, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, monthlyCouponUpdateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { id } = await params;
    const payload = { ...parsed.data };
    if (payload.code) payload.code = payload.code.toUpperCase();
    const { data, error } = await supabaseAdmin()
      .from("monthly_coupons")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return serverError(error);
    if (!data) return notFound("Coupon not found");
    return ok(data);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin().from("monthly_coupons").delete().eq("id", id);
    if (error) return serverError(error);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}
