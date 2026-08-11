import PlottingMapBoard from "@/components/PlottingMapBoard";
import { attachAppOrders } from "@/lib/server/appOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  return todayISO().slice(0, 7);
}

function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}` };
}

function parseMonth(sp: { month?: string; date?: string }): string {
  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) return sp.month;
  // Back-compat: ?date=YYYY-MM-DD → that month
  if (sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)) return sp.date.slice(0, 7);
  return currentMonth();
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; date?: string; knight_id?: string }>;
}) {
  const sp = await searchParams;
  const knightId = sp.knight_id ?? "";
  const db = supabaseAdmin();

  let month = parseMonth(sp);

  // Default to the latest delivery month when the current month is empty.
  if (!sp.month && !sp.date) {
    const { from, to } = monthRange(month);
    const { count } = await db
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .gte("task_date", from)
      .lte("task_date", to)
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
      if (latest?.task_date) month = latest.task_date.slice(0, 7);
    }
  }

  const { from, to } = monthRange(month);

  let query = db
    .from("deliveries")
    .select(
      "id, serial_no, sender_name, pickup_location, drop_location, pickup_lat, pickup_lng, drop_lat, drop_lng, knight_name, knight_id, fulfillment_status, mode_of_booking, app_order_id, task_date",
    )
    .gte("task_date", from)
    .lte("task_date", to)
    .neq("fulfillment_status", "cancelled")
    .not("pickup_location", "is", null)
    .not("drop_location", "is", null)
    .neq("pickup_location", "")
    .neq("drop_location", "")
    .order("task_date", { ascending: true })
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
      initialMonth={month}
      initialKnightId={knightId}
    />
  );
}
