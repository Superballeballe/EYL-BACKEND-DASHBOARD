import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import RatesBoard from "@/components/RatesBoard";
import type { RateTier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RatesPage() {
  const { data } = await supabaseAdmin()
    .from("rate_tiers")
    .select("*")
    .order("provider")
    .order("min_km", { ascending: true, nullsFirst: true });
  const tiers = (data ?? []) as RateTier[];

  return (
    <div>
      <PageHeader
        title="Rate Cards"
        subtitle="Km-based pricing used to suggest delivery fees"
      />
      <RatesBoard tiers={tiers} />
    </div>
  );
}
