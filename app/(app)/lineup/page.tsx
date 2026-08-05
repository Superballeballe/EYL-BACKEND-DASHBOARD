import LineupEditor from "@/components/LineupEditor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LineupPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const { data } = await supabaseAdmin()
    .from("knights")
    .select("id, display_name, role, default_location")
    .eq("active", true)
    .order("display_name");

  return (
    <div>
      <LineupEditor knights={data ?? []} initialDate={date} />
    </div>
  );
}
