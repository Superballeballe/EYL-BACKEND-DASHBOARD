import { isAppOrderCancelled, isPurgedAppDelivery } from "@/lib/deliveryStatus";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AppOrderItem, Delivery } from "@/lib/types";

const APP_ORDER_SELECTS = [
  "id, order_code, created_at, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at, confirmed_at, pending_knight_id, payment_deadline_at, confirm_deadline_at, pickup_instructions, delivery_instructions, invoices(payment_status, total_amount, metadata)",
  "id, order_code, created_at, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at, confirmed_at, pending_knight_id, payment_deadline_at, pickup_instructions, delivery_instructions, invoices(payment_status, metadata)",
  "id, order_code, created_at, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at, confirmed_at, pending_knight_id, payment_deadline_at",
  "id, order_code, created_at, status, rider_name, scheduled_for, pickup_scheduled_at, delivery_scheduled_at, accepted_at, rider_assigned_at",
  "id, order_code, created_at, status, scheduled_for, pickup_scheduled_at, delivery_scheduled_at",
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

  const [{ data: invoices }, { data: orderRows }, planCodeByOrder, itemsByOrder] = await Promise.all([
    db.from("invoices").select("order_id, payment_status, total_amount, metadata").in("order_id", ids),
    db.from("orders").select("id, pickup_instructions, delivery_instructions").in("id", ids),
    loadPlanCodes(db, ids),
    loadOrderItems(db, ids),
  ]);

  const invoiceByOrder = new Map<
    string,
    { payment_status?: string | null; total_amount?: number | null; metadata?: Record<string, unknown> | null }
  >();
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
      plan_code: planCodeByOrder.get(order.id) ?? null,
      items: itemsByOrder.get(order.id) ?? [],
      invoices: invoice
        ? {
            payment_status: invoice.payment_status ?? existing?.payment_status ?? null,
            total_amount: invoice.total_amount ?? existing?.total_amount ?? null,
            metadata: invoice.metadata ?? existing?.metadata ?? null,
          }
        : order.invoices ?? existing ?? null,
    };
  });
}

/**
 * The delivery plan code of each order that is a plan day (EYL-APP migration
 * 20261114120000). Before that migration orders have no plan_id: no codes,
 * logged, and the rows still load.
 */
async function loadPlanCodes(db: ReturnType<typeof supabaseAdmin>, orderIds: string[]): Promise<Map<string, string>> {
  const codes = new Map<string, string>();
  const { data: days, error } = await db.from("orders").select("id, plan_id").in("id", orderIds).not("plan_id", "is", null);
  if (error) {
    console.warn("[app-orders] plan days could not be read:", error.message);
    return codes;
  }
  const planIds = Array.from(new Set((days ?? []).map((d) => d.plan_id as string)));
  if (planIds.length === 0) return codes;
  const { data: plans, error: planError } = await db.from("delivery_plans").select("id, plan_code").in("id", planIds);
  if (planError) {
    console.warn("[app-orders] plan codes could not be read:", planError.message);
    return codes;
  }
  const codeByPlan = new Map((plans ?? []).map((p) => [p.id as string, p.plan_code as string]));
  for (const day of days ?? []) {
    const code = codeByPlan.get(day.plan_id as string);
    if (code) codes.set(day.id as string, code);
  }
  return codes;
}

/**
 * The package details of each order. The app and the WhatsApp bot write them to
 * `order_items`; `deliveries.content` is not filled from there.
 */
async function loadOrderItems(db: ReturnType<typeof supabaseAdmin>, orderIds: string[]): Promise<Map<string, AppOrderItem[]>> {
  const items = new Map<string, AppOrderItem[]>();
  const { data, error } = await db
    .from("order_items")
    .select("order_id, description, category, weight_kg, delicate_handling")
    .in("order_id", orderIds)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("[app-orders] package contents could not be read:", error.message);
    return items;
  }
  for (const { order_id, ...item } of data ?? []) {
    const list = items.get(order_id as string);
    if (list) list.push(item);
    else items.set(order_id as string, [item]);
  }
  return items;
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
