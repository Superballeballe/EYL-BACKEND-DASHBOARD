import { z } from "zod";
import { badRequest, notFound, ok, parseBody, serverError } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const nullableIsoDateTime = z.string().datetime({ offset: true }).nullable().optional();

const lifecycleActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({
    action: z.literal("assign"),
    knight_id: z.string().uuid().nullable().optional(),
    knight_name: z.string().trim().min(1, "Knight name is required").nullable().optional(),
    pickup_scheduled_at: nullableIsoDateTime,
    delivery_scheduled_at: nullableIsoDateTime,
  }),
  z.object({ action: z.literal("pickup") }),
  z.object({ action: z.literal("deliver") }),
  z.object({ action: z.literal("cancel") }),
]);

type LifecycleAction = z.infer<typeof lifecycleActionSchema>;
type DeliveryLink = {
  id: string;
  app_order_id: string | null;
  task_date: string | null;
  fulfillment_status: string | null;
};
type OrderPatch = Record<string, unknown>;

function nowIso() {
  return new Date().toISOString();
}

function nowClock() {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

function localDateInIndia(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function scheduleLabel(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

async function getKnightName(knightId: string | null | undefined, fallbackName: string | null | undefined) {
  const cleanFallback = fallbackName?.trim() || null;
  if (!knightId) return cleanFallback;

  const { data, error } = await supabaseAdmin()
    .from("knights")
    .select("display_name")
    .eq("id", knightId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return data?.display_name ?? cleanFallback;
}

function legacyOrderStatus(status: unknown) {
  if (status === "accepted" || status === "rider_assigned") return "placed";
  if (status === "picked_up" || status === "delivered" || status === "cancelled") return status;
  return status;
}

function stripNewOrderColumns(patch: OrderPatch) {
  const supported: OrderPatch = {};
  if ("status" in patch) supported.status = patch.status;
  return supported;
}

async function updateLinkedOrder(db: ReturnType<typeof supabaseAdmin>, orderId: string, desiredPatch: OrderPatch) {
  const selectColumns = "id, order_code, status";
  const update = async (patch: OrderPatch) =>
    db.from("orders").update(patch).eq("id", orderId).select(selectColumns).maybeSingle();

  let result = await update(desiredPatch);
  if (!result.error) return result;

  let fallbackPatch = stripNewOrderColumns(desiredPatch);
  result = await update(fallbackPatch);
  if (!result.error) return result;

  fallbackPatch = {
    ...fallbackPatch,
    status: legacyOrderStatus(fallbackPatch.status),
  };
  return update(fallbackPatch);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, lifecycleActionSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const { id } = await params;
    const db = supabaseAdmin();
    const { data: delivery, error: deliveryError } = await db
      .from("deliveries")
      .select("id, app_order_id, task_date, fulfillment_status")
      .eq("id", id)
      .maybeSingle();

    if (deliveryError) return serverError(deliveryError);
    if (!delivery) return notFound("Delivery not found");

    const action = parsed.data;
    const linkedDelivery = delivery as DeliveryLink;

    const deliveryPatch: Record<string, unknown> = {};
    const orderPatch: Record<string, unknown> = {};
    const stamp = nowIso();

    if (action.action === "confirm") {
      return badRequest("Assign a knight before confirming the order.");
    } else if (action.action === "assign") {
      const knightName = await getKnightName(action.knight_id, action.knight_name);
      if (!knightName) return badRequest("Knight is required");

      deliveryPatch.knight_id = action.knight_id ?? null;
      deliveryPatch.knight_name = knightName;
      deliveryPatch.assignment_status = "assigned";
      if (!["picked_up", "delivered", "cancelled"].includes(linkedDelivery.fulfillment_status ?? "")) {
        deliveryPatch.fulfillment_status = "in_transit";
      }
      deliveryPatch.pickup_time_window = scheduleLabel(action.pickup_scheduled_at);
      deliveryPatch.drop_time_window = scheduleLabel(action.delivery_scheduled_at);
      deliveryPatch.task_date =
        localDateInIndia(action.pickup_scheduled_at) ??
        localDateInIndia(action.delivery_scheduled_at) ??
        linkedDelivery.task_date;

      orderPatch.status = "rider_assigned";
      orderPatch.rider_name = knightName;
      orderPatch.accepted_at = stamp;
      orderPatch.rider_assigned_at = stamp;
      orderPatch.pickup_scheduled_at = action.pickup_scheduled_at ?? null;
      orderPatch.delivery_scheduled_at = action.delivery_scheduled_at ?? null;
    } else if (action.action === "pickup") {
      deliveryPatch.fulfillment_status = "picked_up";
      deliveryPatch.pickup_actual_time = nowClock();
      orderPatch.status = "picked_up";
    } else if (action.action === "deliver") {
      deliveryPatch.fulfillment_status = "delivered";
      deliveryPatch.drop_actual_time = nowClock();
      orderPatch.status = "delivered";
    } else if (action.action === "cancel") {
      deliveryPatch.assignment_status = "cancelled";
      deliveryPatch.fulfillment_status = "cancelled";
      orderPatch.status = "cancelled";
    }

    let updatedDelivery = null;
    if (Object.keys(deliveryPatch).length) {
      const { data, error } = await db
        .from("deliveries")
        .update(deliveryPatch)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) return serverError(error);
      updatedDelivery = data;
    }

    let updatedOrder = null;
    if (linkedDelivery.app_order_id && Object.keys(orderPatch).length) {
      const { data, error } = await updateLinkedOrder(db, linkedDelivery.app_order_id, orderPatch);
      if (error) return serverError(error);
      updatedOrder = data;
    }

    return ok({
      ok: true,
      delivery: updatedDelivery,
      app_order: updatedOrder,
    });
  } catch (e) {
    return serverError(e);
  }
}
