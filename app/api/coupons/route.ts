import { supabaseAdmin } from "@/lib/supabase/admin";
import { monthlyCouponSchema } from "@/lib/schemas";
import { badRequest, created, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    let query = supabaseAdmin()
      .from("monthly_coupons")
      .select("*")
      .order("year_month", { ascending: false });
    if (p.get("year_month")) query = query.eq("year_month", p.get("year_month"));
    if (p.get("active") === "true") query = query.eq("active", true);
    const { data, error } = await query;
    if (error) return serverError(error);
    return ok({ data });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, monthlyCouponSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { data, error } = await supabaseAdmin()
      .from("monthly_coupons")
      .insert(parsed.data)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return badRequest(`Coupon code "${parsed.data.code}" already exists`);
      }
      return serverError(error);
    }
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
