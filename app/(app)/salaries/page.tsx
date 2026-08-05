import { PageHeader } from "@/components/ui";
import SalariesBoard from "@/components/SalariesBoard";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SalariesPage() {
  const { data } = await supabaseAdmin()
    .from("knights")
    .select("id, display_name, role")
    .eq("active", true)
    .order("display_name");
  const knights = data ?? [];

  return (
    <div>
      <PageHeader title="Salaries" subtitle="Monthly travel + salary per knight" />
      <SalariesBoard knights={knights} />
    </div>
  );
}
