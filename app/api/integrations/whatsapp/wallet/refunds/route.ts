import { ok } from "@/lib/api";
import { whatsappWalletMovementSchema } from "@/lib/schemas/whatsapp";
import { parseWhatsappBody, requireIntegrationKey, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { refundWallet } from "@/lib/server/whatsappWallet";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Give back all or part of a wallet charge (once per ref). */
export async function POST(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = await parseWhatsappBody(req, whatsappWalletMovementSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { wa_id, amount_paise, ref, note } = parsed.data;
    return ok(await refundWallet(supabaseAdmin(), wa_id, amount_paise, ref, note));
  } catch (e) {
    return whatsappErrorResponse(e, "wallet refund");
  }
}
