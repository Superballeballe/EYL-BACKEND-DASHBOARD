import { isAppOrderCancelled } from "@/lib/deliveryStatus";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Delivery } from "@/lib/types";

const APP_ORDER_SELECTS = [
  "id, order_code, status, rider_name, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at",
  "id, order_code, status",
  "id, order_code",
];

export async function loadAppOrdersByIds(
  db: ReturnType<typeof supabaseAdmin>,
  appOrderIds: string[],
): Promise<{ orders: NonNullable<Delivery["app_order"]>[]; error: string | null }> {
  if (appOrderIds.length === 0) return { orders: [], error: null };
  for (const columns of APP_ORDER_SELECTS) {
    const { data, error } = await db.from("orders").select(columns).in("id", appOrderIds);
    if (!error) {
      return {
        orders: (data ?? []) as unknown as NonNullable<Delivery["app_order"]>[],
        error: null,
      };
    }
  }
  return { orders: [], error: "App order status could not be loaded." };
}

export async function attachAppOrders<
  T extends {
    app_order_id: string | null;
    id?: string;
    fulfillment_status?: string | null;
    assignment_status?: string | null;
  },
>(
  db: ReturnType<typeof supabaseAdmin>,
  rows: T[],
): Promise<{ rows: (T & { app_order: Delivery["app_order"] })[]; error: string | null }> {
  const appOrderIds = Array.from(
    new Set(rows.map((row) => row.app_order_id).filter((id): id is string => Boolean(id))),
  );
  const { orders, error } = await loadAppOrdersByIds(db, appOrderIds);
  const byId = new Map(orders.map((o) => [o.id, o]));
  const enriched = rows.map((row) => ({
    ...row,
    app_order: row.app_order_id ? byId.get(row.app_order_id) ?? null : null,
  }));

  const staleIds = enriched
    .filter(
      (row) =>
        row.id &&
        isAppOrderCancelled(row.app_order) &&
        row.fulfillment_status !== "cancelled",
    )
    .map((row) => row.id as string);

  if (staleIds.length) {
    const { error: syncError } = await db
      .from("deliveries")
      .update({ fulfillment_status: "cancelled", assignment_status: "cancelled" })
      .in("id", staleIds);
    if (syncError) console.warn("[sync] app-cancelled deliveries:", syncError.message);
    const stale = new Set(staleIds);
    return {
      error,
      rows: enriched.map((row) =>
        row.id && stale.has(row.id)
          ? { ...row, fulfillment_status: "cancelled" as const, assignment_status: "cancelled" as const }
          : row,
      ),
    };
  }

  return { error, rows: enriched };
}
