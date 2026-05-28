import { PageHeader, EmptyState } from "@/components/ui";
import SalaryGrid from "@/components/SalaryGrid";
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
    <div className="max-w-4xl">
      <PageHeader title="Salaries" subtitle="Monthly travel + salary per knight" />
      {knights.length === 0 ? (
        <EmptyState message="Add knights first (or run the import), then record salaries here." />
      ) : (
        <SalaryGrid knights={knights} />
      )}
    </div>
  );
}
