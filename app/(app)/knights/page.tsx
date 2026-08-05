import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import KnightsBoard from "@/components/KnightsBoard";
import type { Knight } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnightsPage() {
  const { data } = await supabaseAdmin().from("knights").select("*").order("display_name");
  const knights = (data ?? []) as Knight[];

  return (
    <div>
      <PageHeader title="Knights" subtitle={`${knights.length} delivery staff`} />
      <KnightsBoard knights={knights} />
    </div>
  );
}
