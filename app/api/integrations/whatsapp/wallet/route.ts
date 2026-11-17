import { badRequest, ok } from "@/lib/api";
import { whatsappWalletQuerySchema } from "@/lib/schemas/whatsapp";
import { requireIntegrationKey, searchParamsObject, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { getWallet } from "@/lib/server/whatsappWallet";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** A WhatsApp customer's EYL wallet: balance, limits and the latest movements. */
export async function GET(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  const parsed = whatsappWalletQuerySchema.safeParse(searchParamsObject(req));
  if (!parsed.success) return badRequest("Validation failed", parsed.error.flatten());
  try {
    return ok(await getWallet(supabaseAdmin(), parsed.data.wa_id));
  } catch (e) {
    return whatsappErrorResponse(e, "wallet");
  }
}
