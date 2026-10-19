import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import RatesBoard from "@/components/RatesBoard";
import HandlingFeesBoard from "@/components/HandlingFeesBoard";
import { APP_HANDLING_FEE_CODES } from "@/lib/pricing/handlingFees";
import type { PricingSurcharge, RateTier } from "@/lib/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const db = supabaseAdmin();
  const [{ data }, { data: feeData, error: feeError }] = await Promise.all([
    db
      .from("rate_tiers")
      .select("*")
      .order("provider")
      .order("min_km", { ascending: true, nullsFirst: true }),
    db.from("pricing_surcharges").select("*").in("code", APP_HANDLING_FEE_CODES),
  ]);
  const tiers = (data ?? []) as RateTier[];

  return (
    <div>
      <PageHeader
        title="Rate Cards"
        subtitle="Km-based rate cards. Current eyl rows are the live app prices customers pay."
      />
      <RatesBoard tiers={tiers} />
      <Box sx={{ mt: 4 }}>
        {feeError ? (
          <Typography color="error" sx={{ p: 2 }}>
            Failed to load handling fees: {feeError.message}
          </Typography>
        ) : (
          <HandlingFeesBoard fees={(feeData ?? []) as PricingSurcharge[]} />
        )}
      </Box>
    </div>
  );
}
