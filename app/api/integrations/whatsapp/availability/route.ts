import { ok } from "@/lib/api";
import { availability } from "@/lib/holidays";
import { listUpcomingHolidays } from "@/lib/server/holidays";
import { requireIntegrationKey, whatsappErrorResponse } from "@/lib/server/whatsappHttp";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Whether EYL takes orders today, and which upcoming days are closed (service
 * holidays, set on the dashboard's Holidays page). Bookings on a closed day are
 * refused anyway (422 not_accepting_orders); this lets the bot say so up front.
 */
export async function GET(req: Request) {
  const denied = requireIntegrationKey(req);
  if (denied) return denied;
  try {
    const days = await listUpcomingHolidays(supabaseAdmin());
    return ok(availability(days.map((h) => h.day)));
  } catch (e) {
    return whatsappErrorResponse(e, "availability");
  }
}
