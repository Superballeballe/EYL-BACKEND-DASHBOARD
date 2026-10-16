import { ok } from "@/lib/api";
import { whatsappQuoteSchema } from "@/lib/schemas/whatsapp";
import { parseWhatsappBody, requireIntegrationKey, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { quoteWhatsappBooking } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Price a route exactly as reprice_order would (quote_booking). */
export async function POST(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = await parseWhatsappBody(req, whatsappQuoteSchema);
  if ("error" in parsed) return parsed.error;
  try {
    return ok(await quoteWhatsappBooking(supabaseAdmin(), parsed.data));
  } catch (e) {
    return whatsappErrorResponse(e, "quote");
  }
}
