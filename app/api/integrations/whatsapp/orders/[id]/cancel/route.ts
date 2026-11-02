import { z } from "zod";
import { badRequest, ok } from "@/lib/api";
import { requireIntegrationKey, UUID_RE, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { cancelWhatsappOrder } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  wa_id: z.string().regex(/^91[6-9]\d{9}$/, "wa_id must be an Indian mobile wa_id"),
  reason_code: z.string().max(40).nullish(),
  note: z.string().max(500).nullish(),
});

/** The customer cancels their WhatsApp order before pickup; a paid order is refunded in full. */
export async function POST(req: Request, { params }: Ctx) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) return badRequest("That order id isn't valid.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");
  try {
    return ok(await cancelWhatsappOrder(supabaseAdmin(), id, parsed.data));
  } catch (e) {
    return whatsappErrorResponse(e, "cancel");
  }
}
