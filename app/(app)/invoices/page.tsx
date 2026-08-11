import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import InvoicesBoard from "@/components/InvoicesBoard";
import type { AppInvoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { data, error } = await supabaseAdmin()
    .from("invoices")
    .select(
      "id, order_id, invoice_number, invoice_type, payment_method, payment_status, subtotal, discount_amount, tax_amount, total_amount, is_gst, seller_gstin, buyer_gstin, taxable_value, cgst_amount, sgst_amount, igst_amount, is_interstate, issued_at, metadata, orders(order_code)",
    )
    .order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);
  const invoices = (data ?? []).map((inv) => ({
    ...inv,
    orders: Array.isArray(inv.orders) ? (inv.orders[0] ?? null) : inv.orders,
  })) as AppInvoice[];

  return (
    <div>
      <PageHeader
        title="Tax invoices"
        subtitle="App-issued invoices for GST reporting — read from Supabase"
      />
      <InvoicesBoard invoices={invoices} />
    </div>
  );
}
