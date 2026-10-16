import { badRequest, ok } from "@/lib/api";
import { whatsappEventsQuerySchema } from "@/lib/schemas/whatsapp";
import { requireIntegrationKey, searchParamsObject, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { listWhatsappEvents } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Outbox pull: integration_order_events after a cursor, in id order. */
export async function GET(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = whatsappEventsQuerySchema.safeParse(searchParamsObject(req));
  if (!parsed.success) return badRequest("Validation failed", parsed.error.flatten());
  try {
    return ok(await listWhatsappEvents(supabaseAdmin(), parsed.data.after, parsed.data.limit));
  } catch (e) {
    return whatsappErrorResponse(e, "events");
  }
}
