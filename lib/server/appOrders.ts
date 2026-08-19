import { isAppOrderCancelled, isPurgedAppDelivery } from "@/lib/deliveryStatus";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Delivery } from "@/lib/types";

const APP_ORDER_SELECTS = [
  "id, order_code, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at, confirmed_at, pending_knight_id, payment_deadline_at, pickup_instructions, delivery_instructions, invoices(payment_status, metadata)",
  "id, order_code, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at, confirmed_at, pending_knight_id, payment_deadline_at",
  "id, order_code, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at",
  "id, order_code, status, scheduled_for, pickup_scheduled_at, delivery_scheduled_at",
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
      const orders = await enrichAppOrdersWithRouteMeta(
        db,
        (data ?? []) as unknown as NonNullable<Delivery["app_order"]>[],
      );
      return { orders, error: null };
    }
  }
  return { orders: [], error: "App order status could not be loaded." };
}

async function enrichAppOrdersWithRouteMeta(
  db: ReturnType<typeof supabaseAdmin>,
  orders: NonNullable<Delivery["app_order"]>[],
): Promise<NonNullable<Delivery["app_order"]>[]> {
  if (orders.length === 0) return orders;
  const ids = orders.map((order) => order.id);

  const [{ data: invoices }, { data: orderRows }] = await Promise.all([
    db.from("invoices").select("order_id, payment_status, metadata").in("order_id", ids),
    db.from("orders").select("id, pickup_instructions, delivery_instructions").in("id", ids),
  ]);

  const invoiceByOrder = new Map<string, { payment_status?: string | null; metadata?: Record<string, unknown> | null }>();
  for (const invoice of invoices ?? []) {
    if (!invoiceByOrder.has(invoice.order_id)) {
      invoiceByOrder.set(invoice.order_id, invoice);
    }
  }

  const instructionsByOrder = new Map(
    (orderRows ?? []).map((row) => [row.id as string, row as { pickup_instructions?: string | null; delivery_instructions?: string | null }]),
  );

  return orders.map((order) => {
    const invoice = invoiceByOrder.get(order.id);
    const instructions = instructionsByOrder.get(order.id);
    const existing = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;

    return {
      ...order,
      pickup_instructions: instructions?.pickup_instructions ?? order.pickup_instructions ?? null,
      delivery_instructions: instructions?.delivery_instructions ?? order.delivery_instructions ?? null,
      invoices: invoice
        ? {
            payment_status: invoice.payment_status ?? existing?.payment_status ?? null,
            metadata: invoice.metadata ?? existing?.metadata ?? null,
          }
        : order.invoices ?? existing ?? null,
    };
  });
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
      rows: enriched
        .map((row) =>
          row.id && stale.has(row.id)
            ? { ...row, fulfillment_status: "cancelled" as const, assignment_status: "cancelled" as const }
            : row,
        )
        .filter((row) => !isPurgedAppDelivery(row)),
    };
  }

  return {
    error,
    rows: enriched.filter((row) => !isPurgedAppDelivery(row)),
  };
}
