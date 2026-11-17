import { ok } from "@/lib/api";
import { whatsappWalletTopupSchema } from "@/lib/schemas/whatsapp";
import { parseWhatsappBody, requireIntegrationKey, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { createWalletTopup } from "@/lib/server/whatsappWallet";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Start a wallet top-up: returns a Razorpay payment link. Credited only once it's paid. */
export async function POST(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = await parseWhatsappBody(req, whatsappWalletTopupSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { wa_id, amount_rupees, name } = parsed.data;
    return ok(await createWalletTopup(supabaseAdmin(), wa_id, amount_rupees * 100, name));
  } catch (e) {
    return whatsappErrorResponse(e, "wallet top-up");
  }
}
