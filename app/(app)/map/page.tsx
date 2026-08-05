import PlottingMapBoard from "@/components/PlottingMapBoard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; knight_id?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const knightId = sp.knight_id ?? "";

  const db = supabaseAdmin();

  let query = db
    .from("deliveries")
    .select(
      "id, serial_no, sender_name, pickup_location, drop_location, pickup_lat, pickup_lng, drop_lat, drop_lng, knight_name, knight_id, fulfillment_status, mode_of_booking, app_order_id",
    )
    .eq("task_date", date)
    .not("knight_name", "is", null)
    .neq("knight_name", "")
    .neq("fulfillment_status", "cancelled")
    .order("serial_no", { ascending: true });

  if (knightId) {
    const { data: knight } = await db.from("knights").select("display_name").eq("id", knightId).maybeSingle();
    const name = knight?.display_name?.replace(/"/g, '\\"');
    if (name) {
      query = query.or(`knight_id.eq.${knightId},knight_name.eq."${name}"`);
    } else {
      query = query.eq("knight_id", knightId);
    }
  }

  const [{ data: deliveries }, { data: knights }] = await Promise.all([
    query,
    db.from("knights").select("id, display_name").eq("active", true).order("display_name"),
  ]);

  return (
    <PlottingMapBoard
      deliveries={deliveries ?? []}
      knights={knights ?? []}
      initialDate={date}
      initialKnightId={knightId}
    />
  );
}
