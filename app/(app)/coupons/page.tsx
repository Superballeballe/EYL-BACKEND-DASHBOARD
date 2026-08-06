import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import CouponsBoard from "@/components/CouponsBoard";
import type { MonthlyCoupon } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const { data, error } = await supabaseAdmin()
    .from("monthly_coupons")
    .select("*")
    .order("year_month", { ascending: false });
  if (error) throw new Error(error.message);
  const coupons = (data ?? []) as MonthlyCoupon[];

  return (
    <div>
      <PageHeader
        title="Coupons"
        subtitle="Set one promo code per month for the mobile app"
      />
      <CouponsBoard coupons={coupons} />
    </div>
  );
}
