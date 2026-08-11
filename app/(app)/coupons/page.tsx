import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import CouponsBoard from "@/components/CouponsBoard";
import type { CouponRedemption, MonthlyCoupon } from "@/lib/types";
import Typography from "@mui/material/Typography";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const db = supabaseAdmin();
  const [{ data, error }, { data: redemptions, error: redemptionsError }] = await Promise.all([
    db.from("monthly_coupons").select("*").order("year_month", { ascending: false }),
    db
      .from("coupon_redemptions")
      .select(
        "id, coupon_id, user_id, order_id, code, redeemed_at, orders(order_code), monthly_coupons(code, label)",
      )
      .order("redeemed_at", { ascending: false })
      .limit(100),
  ]);
  if (error || redemptionsError) {
    return (
      <div>
        <PageHeader title="Coupons" subtitle="Promo codes for the EYL mobile app" />
        <Typography color="error" sx={{ p: 2 }}>
          Failed to load: {error?.message ?? redemptionsError?.message}
        </Typography>
      </div>
    );
  }
  const coupons = (data ?? []) as MonthlyCoupon[];
  const redemptionRows = (redemptions ?? []).map((r) => ({
    ...r,
    orders: Array.isArray(r.orders) ? (r.orders[0] ?? null) : r.orders,
    monthly_coupons: Array.isArray(r.monthly_coupons)
      ? (r.monthly_coupons[0] ?? null)
      : r.monthly_coupons,
  })) as CouponRedemption[];

  return (
    <div>
      <PageHeader title="Coupons" subtitle="Promo codes for the EYL mobile app" />
      <CouponsBoard coupons={coupons} redemptions={redemptionRows} />
    </div>
  );
}
