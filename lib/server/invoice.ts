import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInvoiceNo, parseInvoiceNo } from "@/lib/invoice";

export { formatInvoiceNo, parseInvoiceNo } from "@/lib/invoice";

export async function maxInvoiceSeq(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from("deliveries")
    .select("invoice_no")
    .not("invoice_no", "is", null);

  if (error) throw error;

  let max = 0;
  for (const row of data ?? []) {
    const n = parseInvoiceNo(row.invoice_no as string | null);
    if (n != null && n > max) max = n;
  }
  return max;
}

export async function nextInvoiceNo(db: SupabaseClient) {
  const seq = (await maxInvoiceSeq(db)) + 1;
  return { invoice_seq: seq, invoice_no: formatInvoiceNo(seq) };
}
