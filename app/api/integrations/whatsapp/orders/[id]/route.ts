import { badRequest, ok } from "@/lib/api";
import { requireIntegrationKey, UUID_RE, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { getWhatsappOrder } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** One WhatsApp-placed order (404 for orders not in whatsapp_order_links). */
export async function GET(req: Request, { params }: Ctx) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) return badRequest("That order id isn't valid.");
  try {
    return ok(await getWhatsappOrder(supabaseAdmin(), id));
  } catch (e) {
    return whatsappErrorResponse(e, "get order");
  }
}
