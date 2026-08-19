import { supabaseAdmin } from "@/lib/supabase/admin";
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
      <PageHeader
        title="Cancelled orders"
        subtitle="Customer cancellations with reason. Pending refunds can be paid back through Razorpay from this table."
      />
      <CancelledOrdersTable rows={rows} />
    </div>
  );
}
