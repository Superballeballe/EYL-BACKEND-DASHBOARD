import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import EylKnightsBoard from "@/components/EylKnightsBoard";
import type { EylKnight } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EylKnightsPage() {
  const { data } = await supabaseAdmin()
    .from("eyl_knights")
    .select("*")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const applicants = (data ?? []) as EylKnight[];

  return (
    <div>
      <PageHeader
        title="Approve new knights"
        subtitle={`${applicants.length} applicant${applicants.length === 1 ? "" : "s"}`}
      />
      <EylKnightsBoard applicants={applicants} />
    </div>
  );
}
