import { supabaseAdmin } from "@/lib/supabase/admin";

/** Shared option lists for the delivery form (knights, clients, EYL rate tiers). */
export async function getDeliveryFormOptions() {
  const db = supabaseAdmin();
  const [knights, clients, rates] = await Promise.all([
    db.from("knights").select("id, display_name").eq("active", true).order("display_name"),
    db.from("clients").select("id, client_name, company_name, gst_no, address").order("client_name"),
    db
      .from("rate_tiers")
      .select("min_km, max_km, fee")
      .eq("provider", "eyl")
      .eq("is_current", true)
      .order("min_km", { nullsFirst: true }),
  ]);
  return {
    knights: knights.data ?? [],
    clients: clients.data ?? [],
    rateTiers: rates.data ?? [],
  };
}
