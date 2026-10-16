import { badRequest, ok } from "@/lib/api";
import { requireIntegrationKey, UUID_RE, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { reissuePaymentLink } from "@/lib/server/whatsappOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Return the active payment link, or issue a new one; payability is re-checked. */
export async function POST(req: Request, { params }: Ctx) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) return badRequest("That order id isn't valid.");
  try {
    return ok(await reissuePaymentLink(supabaseAdmin(), id));
  } catch (e) {
    return whatsappErrorResponse(e, "payment link");
  }
}
