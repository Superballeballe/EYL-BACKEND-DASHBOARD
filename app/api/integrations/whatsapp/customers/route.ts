import { ok } from "@/lib/api";
import { whatsappCustomerSchema } from "@/lib/schemas/whatsapp";
import { parseWhatsappBody, requireIntegrationKey, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { ensureCustomer } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Resolve (or create) the EYL customer for a WhatsApp number. */
export async function POST(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = await parseWhatsappBody(req, whatsappCustomerSchema);
  if ("error" in parsed) return parsed.error;
  try {
    return ok(await ensureCustomer(supabaseAdmin(), parsed.data.wa_id, parsed.data.name));
  } catch (e) {
    return whatsappErrorResponse(e, "customers");
  }
}
