import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextInvoiceNo } from "@/lib/server/invoice";
import { ok, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await nextInvoiceNo(supabaseAdmin());
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
