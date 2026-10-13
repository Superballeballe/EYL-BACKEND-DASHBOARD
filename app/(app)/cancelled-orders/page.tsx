import { supabaseAdmin } from "@/lib/supabase/admin";
import AutoRefresh from "@/components/AutoRefresh";
import { PageHeader } from "@/components/ui";
import CancelledOrdersTable from "@/components/CancelledOrdersTable";
import type { CancelledOrder } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CancelledOrdersPage() {
  const { data, error } = await supabaseAdmin()
    .from("cancelled_orders")
    .select("*")
    .order("cancelled_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CancelledOrder[];

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        title="Cancelled orders"
        subtitle="Cancellations with reason. A paid order cancelled before pickup is refunded in full, automatically. Only a failed refund needs a retry."
      />
      <CancelledOrdersTable rows={rows} />
    </div>
  );
}
