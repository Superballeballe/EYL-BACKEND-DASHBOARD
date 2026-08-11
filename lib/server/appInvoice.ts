import { buildAppInvoiceHtml, type AppInvoiceRow, type AppOrderRow } from "@/lib/appInvoiceHtml";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getAppInvoiceBundle(id: string) {
  const db = supabaseAdmin();
  const { data: invoice, error } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice) return null;

  const { data: order } = await db
    .from("orders")
    .select("order_code, pickup_address, delivery_address, recipient_name, recipient_phone, total_price")
    .eq("id", invoice.order_id)
    .maybeSingle();

  const html = buildAppInvoiceHtml(invoice as AppInvoiceRow, (order as AppOrderRow | null) ?? null);
  return { invoice: invoice as AppInvoiceRow & { id: string; order_id: string }, order, html };
}
