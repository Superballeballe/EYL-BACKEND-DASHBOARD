import PlottingMapBoard from "@/components/PlottingMapBoard";
import { attachAppOrders } from "@/lib/server/appOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; knight_id?: string }>;
}) {
  const sp = await searchParams;
  const knightId = sp.knight_id ?? "";
  const db = supabaseAdmin();

  let date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();

  // Default to the latest delivery task date when today has nothing to plot.
  if (!sp.date) {
    const { count } = await db
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("task_date", date)
      .neq("fulfillment_status", "cancelled")
      .not("pickup_location", "is", null)
      .not("drop_location", "is", null)
      .neq("pickup_location", "")
      .neq("drop_location", "");
    if (!count) {
      const { data: latest } = await db
        .from("deliveries")
        .select("task_date")
        .neq("fulfillment_status", "cancelled")
        .not("pickup_location", "is", null)
        .not("drop_location", "is", null)
        .neq("pickup_location", "")
        .neq("drop_location", "")
        .order("task_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.task_date) date = latest.task_date;
    }
  }

  let query = db
    .from("deliveries")
    .select(
      "id, serial_no, sender_name, pickup_location, drop_location, pickup_lat, pickup_lng, drop_lat, drop_lng, knight_name, knight_id, fulfillment_status, mode_of_booking, app_order_id",
    )
    .eq("task_date", date)
    .neq("fulfillment_status", "cancelled")
    .not("pickup_location", "is", null)
    .not("drop_location", "is", null)
    .neq("pickup_location", "")
    .neq("drop_location", "")
    .order("serial_no", { ascending: true, nullsFirst: false });

  if (knightId) {
    if (knightId.startsWith("name:")) {
      const name = knightId.slice(5).replace(/"/g, '\\"');
      query = query.eq("knight_name", name);
    } else {
      const { data: knight } = await db.from("knights").select("display_name").eq("id", knightId).maybeSingle();
      const name = knight?.display_name?.replace(/"/g, '\\"');
      if (name) {
        query = query.or(`knight_id.eq.${knightId},knight_name.eq."${name}"`);
      } else {
        query = query.eq("knight_id", knightId);
      }
    }
  }

  const { data: deliveryRows } = await query;
  const { rows: deliveries } = await attachAppOrders(db, deliveryRows ?? []);

  // Knights present on today's deliveries (by id or name), plus any selected knight.
  const nameSet = new Set<string>();
  const idSet = new Set<string>();
  for (const d of deliveries) {
    if (d.knight_id) idSet.add(d.knight_id);
    if (d.knight_name?.trim()) nameSet.add(d.knight_name.trim());
  }

  const { data: allKnights } = await db
    .from("knights")
    .select("id, display_name")
    .eq("active", true)
    .order("display_name");

  const knightsFromDeliveries = (allKnights ?? []).filter(
    (k) => idSet.has(k.id) || nameSet.has(k.display_name),
  );

  // Include name-only knights (e.g. assigned before knight_id was set).
  const knownNames = new Set(knightsFromDeliveries.map((k) => k.display_name));
  for (const name of nameSet) {
    if (!knownNames.has(name)) {
      knightsFromDeliveries.push({ id: `name:${name}`, display_name: name });
    }
  }

  return (
    <PlottingMapBoard
      deliveries={deliveries}
      knights={knightsFromDeliveries}
      initialDate={date}
      initialKnightId={knightId}
    />
  );
}
