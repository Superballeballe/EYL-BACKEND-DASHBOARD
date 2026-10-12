import { z } from "zod";
import { badRequest, notFound, ok, parseBody, serverError } from "@/lib/api";
import { isWithinWorkingHours, workingHoursError } from "@/lib/format";
import {
  sendOrderAssignedNotification,
  sendOrderConfirmedNotification,
} from "@/lib/server/expoPush";
import {
  assignBlockedReason,
  confirmBlockedReason,
  friendlyOrderUpdateError,
  isOrderGuardError,
  type AppInvoiceGuardInput,
} from "@/lib/appOrderLifecycle";
import { isAppOrderCancelled } from "@/lib/deliveryStatus";
import { opsCancelAppOrder } from "@/lib/server/opsCancel";
import { opsActor } from "@/lib/server/opsRefund";
import { getSessionUser } from "@/lib/server/session";
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
  knight_id: string | null;
  knight_name: string | null;
};
type OrderPatch = Record<string, unknown>;

const DELIVERY_LINK_SELECT =
  "id, app_order_id, task_date, fulfillment_status, knight_id, knight_name";

async function loadLinkedDelivery(db: ReturnType<typeof supabaseAdmin>, id: string) {
  const { data, error } = await db
    .from("deliveries")
    .select(DELIVERY_LINK_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as DeliveryLink;

  // ponytail: stale tabs sometimes still hold the app order id after a resync.
  const { data: byOrder, error: byOrderError } = await db
    .from("deliveries")
    .select(DELIVERY_LINK_SELECT)
    .eq("app_order_id", id)
    .maybeSingle();
  if (byOrderError) throw byOrderError;
  return (byOrder as DeliveryLink | null) ?? null;
}

/**
 * Ops cancel of an app order. The database cancels it and refunds a paid
 * order 100% before pickup (no fee); the dashboard only mirrors the result
 * on its own deliveries row.
 */
async function cancelAppOrderFromDashboard(
  db: ReturnType<typeof supabaseAdmin>,
  delivery: DeliveryLink,
  actor: string,
) {
  const orderId = delivery.app_order_id;
  if (!orderId) throw new Error("Linked app order is missing");

  const result = await opsCancelAppOrder(orderId, "Cancelled from dashboard", actor);
  if (!result.ok) return result;

  const { data: updatedDelivery, error: deliveryError } = await db
    .from("deliveries")
    .update({
      fulfillment_status: "cancelled",
      assignment_status: "cancelled",
    })
    .eq("id", delivery.id)
    .select()
    .maybeSingle();
  if (deliveryError) throw new Error(deliveryError.message);

  const { data: updatedOrder } = await db
    .from("orders")
    .select("id, order_code, status")
    .eq("id", orderId)
    .maybeSingle();

  return {
    ok: true as const,
    delivery: updatedDelivery,
    app_order: updatedOrder,
    refund_message: result.refund_message ?? null,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function floorToMinute(date: Date) {
  const floored = new Date(date);
  floored.setSeconds(0, 0);
  return floored;
}

function parseDateTime(iso: string | null | undefined) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateScheduleTimes(pickupIso: string | null | undefined, deliveryIso: string | null | undefined) {
  const pickupAt = parseDateTime(pickupIso);
  const deliveryAt = parseDateTime(deliveryIso);

  if (pickupAt && pickupAt < floorToMinute(new Date())) {
    return "Pickup time cannot be earlier than the current time.";
  }

  if (pickupAt && deliveryAt && deliveryAt < pickupAt) {
    return "Delivery time cannot be earlier than pickup time.";
  }

  if (pickupIso && !isWithinWorkingHours(pickupIso)) return workingHoursError();
  if (deliveryIso && !isWithinWorkingHours(deliveryIso)) return workingHoursError();

  return null;
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
    .select("display_name, profile_id")
    .eq("id", knightId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return data?.display_name ?? cleanFallback;
}

async function getKnightProfileId(knightId: string | null | undefined) {
  if (!knightId) return null;
  const { data, error } = await supabaseAdmin()
    .from("knights")
    .select("profile_id")
    .eq("id", knightId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.profile_id as string | null | undefined) ?? null;
}

async function getAppInvoice(
  db: ReturnType<typeof supabaseAdmin>,
  orderId: string,
): Promise<AppInvoiceGuardInput> {
  const { data, error } = await db
    .from("invoices")
    .select("payment_status, total_amount")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AppInvoiceGuardInput) ?? null;
}

function legacyOrderStatus(status: unknown) {
  if (status === "accepted") return "placed";
  if (status === "rider_assigned" || status === "picked_up") return "in_transit";
  if (status === "delivered") return "completed";
  if (status === "cancelled") return "canceled";
  return status;
}

function assignmentOrderStatus(fulfillmentStatus: string | null | undefined) {
  if (fulfillmentStatus === "completed") return "delivered";
  if (fulfillmentStatus === "cancelled") return "cancelled";
  return "rider_assigned";
}

function stripNewOrderColumns(patch: OrderPatch) {
  const supported: OrderPatch = {};
  if ("status" in patch) supported.status = patch.status;
  return supported;
}

async function updateLinkedOrder(db: ReturnType<typeof supabaseAdmin>, orderId: string, desiredPatch: OrderPatch) {
  const richSelectColumns =
    "id, order_code, status, rider_name, accepted_at, rider_assigned_at, scheduled_for, pickup_scheduled_at, delivery_scheduled_at";
  const baseSelectColumns = "id, order_code, status";
  const update = async (patch: OrderPatch, selectColumns = richSelectColumns) =>
    db.from("orders").update(patch).eq("id", orderId).select(selectColumns).maybeSingle();

  let result = await update(desiredPatch);
  if (!result.error) return result;
  // A pay-first guard said no (not paid / window closed). Retrying with only
  // the status would move the order on without confirming it.
  if (isOrderGuardError(result.error)) return result;

  let fallbackPatch = stripNewOrderColumns(desiredPatch);
  if (Object.keys(fallbackPatch).length === 0) return result;

  result = await update(fallbackPatch, baseSelectColumns);
  if (!result.error) return result;

  fallbackPatch = {
    ...fallbackPatch,
    status: legacyOrderStatus(fallbackPatch.status),
  };
  return update(fallbackPatch, baseSelectColumns);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const parsed = await parseBody(req, lifecycleActionSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const { id } = await params;
    const db = supabaseAdmin();
    let linkedDelivery: DeliveryLink;
    try {
      const delivery = await loadLinkedDelivery(db, id);
      if (!delivery) return notFound("Delivery not found");
      linkedDelivery = delivery;
    } catch (deliveryError) {
      return serverError(deliveryError);
    }

    const action = parsed.data;

    const deliveryPatch: Record<string, unknown> = {};
    const orderPatch: Record<string, unknown> = {};
    const stamp = nowIso();

    if (action.action === "confirm") {
      if (!linkedDelivery.app_order_id) {
        return badRequest("This delivery has no linked app order.");
      }

      const { data: appOrder, error: orderError } = await db
        .from("orders")
        .select("status, confirmed_at, confirm_deadline_at")
        .eq("id", linkedDelivery.app_order_id)
        .maybeSingle();
      if (orderError) return serverError(orderError);
      if (!appOrder) return notFound("Linked app order not found");

      // Pay-first: the customer pays, then ops confirm before the deadline.
      const invoice = await getAppInvoice(db, linkedDelivery.app_order_id);
      const blocked = confirmBlockedReason(appOrder, invoice);
      if (blocked) return badRequest(blocked);

      deliveryPatch.fulfillment_status = "accepted";
      orderPatch.confirmed_at = stamp;
      orderPatch.accepted_at = stamp;
      orderPatch.status = "accepted";
    } else if (action.action === "assign") {
      const profileId = await getKnightProfileId(action.knight_id);
      if (linkedDelivery.app_order_id) {
        const { data: appOrder, error: orderError } = await db
          .from("orders")
          .select("status, confirmed_at, confirm_deadline_at, assigned_knight_id, pending_knight_id")
          .eq("id", linkedDelivery.app_order_id)
          .maybeSingle();
        if (orderError) return serverError(orderError);
        if (isAppOrderCancelled(appOrder)) {
          return badRequest("This app order was cancelled — restore it before assigning a knight.");
        }
        if (appOrder?.assigned_knight_id) {
          return badRequest("A knight is already assigned to this order.");
        }

        const invoice = await getAppInvoice(db, linkedDelivery.app_order_id);
        const blocked = assignBlockedReason(appOrder, invoice, {
          setsAppKnight: Boolean(profileId),
        });
        if (blocked) return badRequest(blocked);
      }

      const scheduleError = validateScheduleTimes(action.pickup_scheduled_at, action.delivery_scheduled_at);
      if (scheduleError) return badRequest(scheduleError);

      const knightName = await getKnightName(action.knight_id, action.knight_name);
      if (!knightName) return badRequest("Knight is required");

      deliveryPatch.knight_id = action.knight_id ?? null;
      deliveryPatch.knight_name = knightName;
      deliveryPatch.assignment_status = "assigned";
      if (!["active", "completed", "cancelled"].includes(linkedDelivery.fulfillment_status ?? "")) {
        deliveryPatch.fulfillment_status = "accepted";
      }
      deliveryPatch.pickup_time_window = scheduleLabel(action.pickup_scheduled_at);
      deliveryPatch.drop_time_window = scheduleLabel(action.delivery_scheduled_at);
      deliveryPatch.task_date =
        localDateInIndia(action.pickup_scheduled_at) ??
        localDateInIndia(action.delivery_scheduled_at) ??
        linkedDelivery.task_date;

      orderPatch.status = assignmentOrderStatus(linkedDelivery.fulfillment_status);
      orderPatch.rider_name = knightName;
      orderPatch.accepted_at = stamp;
      orderPatch.rider_assigned_at = stamp;
      orderPatch.pickup_scheduled_at = action.pickup_scheduled_at ?? null;
      orderPatch.delivery_scheduled_at = action.delivery_scheduled_at ?? null;

      if (profileId) {
        orderPatch.assigned_knight_id = profileId;
      }
    } else if (action.action === "pickup") {
      if (!linkedDelivery.knight_id && !linkedDelivery.knight_name?.trim()) {
        return badRequest("Assign a knight before marking this delivery picked up.");
      }
      if (linkedDelivery.fulfillment_status !== "accepted") {
        return badRequest("This delivery is not ready for pickup.");
      }
      deliveryPatch.fulfillment_status = "active";
      deliveryPatch.pickup_actual_time = nowClock();
      orderPatch.status = "picked_up";
    } else if (action.action === "deliver") {
      if (linkedDelivery.fulfillment_status !== "active") {
        return badRequest("This delivery has not been picked up yet.");
      }
      deliveryPatch.fulfillment_status = "completed";
      deliveryPatch.drop_actual_time = nowClock();
      orderPatch.status = "delivered";
    } else if (action.action === "cancel") {
      if (!linkedDelivery.app_order_id) {
        deliveryPatch.assignment_status = "cancelled";
        deliveryPatch.fulfillment_status = "cancelled";
      }
    }

    if (action.action === "cancel" && linkedDelivery.app_order_id) {
      const user = await getSessionUser();
      const actor = user ? opsActor(user) : "dashboard-api-key";
      const cancelled = await cancelAppOrderFromDashboard(db, linkedDelivery, actor);
      if (!cancelled.ok) {
        if (cancelled.status === 404) return notFound(cancelled.message);
        if (cancelled.status === 500) return ok({ error: cancelled.message }, { status: 500 });
        return badRequest(cancelled.message);
      }
      return ok(cancelled);
    }

    // Confirm writes the order first: if the DB guard refuses, the delivery
    // must not move to accepted on its own.
    let updatedOrder = null;
    if (action.action === "confirm" && linkedDelivery.app_order_id) {
      const { data, error } = await updateLinkedOrder(db, linkedDelivery.app_order_id, orderPatch);
      if (error) {
        console.error("[lifecycle] confirm app order failed:", error);
        const message = friendlyOrderUpdateError(error, "confirm");
        return isOrderGuardError(error) ? badRequest(message) : serverError(new Error(message));
      }
      updatedOrder = data;
    }

    let updatedDelivery = null;
    if (Object.keys(deliveryPatch).length) {
      const { data, error } = await db
        .from("deliveries")
        .update(deliveryPatch)
        .eq("id", linkedDelivery.id)
        .select()
        .maybeSingle();
      if (error) return serverError(error);
      updatedDelivery = data;
    }

    if (linkedDelivery.app_order_id && Object.keys(orderPatch).length) {
      if (action.action !== "confirm") {
        const { data, error } = await updateLinkedOrder(db, linkedDelivery.app_order_id, orderPatch);
        if (error) {
          if (action.action === "assign" && isOrderGuardError(error)) {
            console.error("[lifecycle] assign app order failed:", error);
            return badRequest(friendlyOrderUpdateError(error, "assign"));
          }
          return serverError(error);
        }
        updatedOrder = data;
      }

      if (action.action === "confirm") {
        try {
          await sendOrderConfirmedNotification(db, { orderId: linkedDelivery.app_order_id });
        } catch (error) {
          console.warn("[notifications] failed to send order confirmed push:", error);
        }
      } else if (action.action === "assign") {
        try {
          await sendOrderAssignedNotification(db, {
            orderId: linkedDelivery.app_order_id,
            knightName: orderPatch.rider_name as string,
            pickupScheduledAt: orderPatch.pickup_scheduled_at as string | null | undefined,
            deliveryScheduledAt: orderPatch.delivery_scheduled_at as string | null | undefined,
          });
        } catch (error) {
          console.warn("[notifications] failed to send assignment push:", error);
        }
      }
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
