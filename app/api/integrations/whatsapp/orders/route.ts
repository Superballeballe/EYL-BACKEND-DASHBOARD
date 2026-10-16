import { badRequest, created, ok } from "@/lib/api";
import { whatsappOrderCreateSchema, whatsappOrdersQuerySchema } from "@/lib/schemas/whatsapp";
import { parseWhatsappBody, requireIntegrationKey, searchParamsObject, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { createWhatsappOrder, listWhatsappOrders } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Place a booking for a WhatsApp customer and return its payment link. Idempotent on `id`. */
export async function POST(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = await parseWhatsappBody(req, whatsappOrderCreateSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { replay, order } = await createWhatsappOrder(supabaseAdmin(), parsed.data);
    return replay ? ok(order) : created(order);
  } catch (e) {
    return whatsappErrorResponse(e, "create order");
  }
}

/** A WhatsApp customer's recent orders, newest first. */
export async function GET(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = whatsappOrdersQuerySchema.safeParse(searchParamsObject(req));
  if (!parsed.success) return badRequest("Validation failed", parsed.error.flatten());
  try {
    return ok({ data: await listWhatsappOrders(supabaseAdmin(), parsed.data.wa_id, parsed.data.limit) });
  } catch (e) {
    return whatsappErrorResponse(e, "list orders");
  }
}
