import { badRequest, ok } from "@/lib/api";
import { requireIntegrationKey, UUID_RE, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { getWalletTopup } from "@/lib/server/whatsappWallet";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Where a top-up stands. A pending one is checked at Razorpay and credited if it was paid. */
export async function GET(req: Request, { params }: Ctx) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const { id } = await params;
  if (!UUID_RE.test(id)) return badRequest("That top-up id isn't valid.");
  try {
    return ok(await getWalletTopup(supabaseAdmin(), id));
  } catch (e) {
    return whatsappErrorResponse(e, "wallet top-up status");
  }
}
