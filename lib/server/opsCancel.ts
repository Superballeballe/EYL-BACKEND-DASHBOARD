import { friendlyOpsCancelError, OPS_CANCEL_MESSAGES, planOpsCancel } from "@/lib/refunds";
import { invokeOpsRefund } from "@/lib/server/opsRefund";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Server-only: cancel an app order as ops. The ONLY place the dashboard
 * writes an app-order cancellation.
 *
 * Business rule: a paid order cancelled before pickup is refunded 100%,
 * automatically, by the database (no fee). The dashboard never computes a
 * refund amount and never inserts cancelled_orders.
 *
 * Primary path: public.ops_cancel_order(p_order_id, p_reason, p_actor)
 * (EYL-APP, service role only), which cancels and queues the full refund in
 * one transaction.
 *
 * TODO(ops_cancel_order): the RPC is not in EYL-APP docs/payment-safety.md
 * yet. Until it is deployed, a missing function falls back to
 * legacyCancelWithoutFee() below. Delete the fallback once the RPC is live.
 */
export type OpsCancelResult =
  | { ok: true; refund_started: boolean | null; refund_message?: string }
  | { ok: false; status: 400 | 404 | 409 | 500; message: string };

type Db = ReturnType<typeof supabaseAdmin>;

/** PostgREST / Postgres "function does not exist". */
function isMissingFunction(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

export async function opsCancelAppOrder(orderId: string, reason: string, actor: string): Promise<OpsCancelResult> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("ops_cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
    p_actor: actor,
  });

  if (error && isMissingFunction(error)) {
    console.warn("[ops-cancel] ops_cancel_order is not deployed; using the fallback");
    return legacyCancelWithoutFee(db, orderId, reason, actor);
  }
  if (error) {
    console.error("[ops-cancel] ops_cancel_order failed", orderId, error.code, error.message);
    return { ok: false, ...friendlyOpsCancelError(null, error.message) };
  }

  const reply = (data ?? {}) as { ok?: boolean; code?: string; message?: string };
  if (reply.ok !== true) {
    console.error("[ops-cancel] ops_cancel_order refused", orderId, reply.code);
    return { ok: false, ...friendlyOpsCancelError(reply.code, reply.message) };
  }
  return { ok: true, refund_started: null };
}

/**
 * TODO(ops_cancel_order): remove once the RPC is deployed.
 *
 * Cancels the order row only (no fee, no cancelled_orders insert, no invoice
 * metadata), then, for a paid order, asks ops-refund "trigger" to queue and
 * send the full refund. ops-refund writes the cancelled_orders row itself
 * (queue_full_refund) and claims the payment in payment_refunds.
 */
async function legacyCancelWithoutFee(db: Db, orderId: string, reason: string, actor: string): Promise<OpsCancelResult> {
  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, status, confirmed_at, assigned_knight_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("[ops-cancel] load order failed", orderId, orderError.message);
    return { ok: false, status: 500, message: OPS_CANCEL_MESSAGES.failed };
  }
  if (!order) return { ok: false, status: 404, message: OPS_CANCEL_MESSAGES.notFound };

  const { data: invoice, error: invoiceError } = await db
    .from("invoices")
    .select("payment_status, total_amount")
    .eq("order_id", orderId)
    .maybeSingle();
  if (invoiceError) {
    console.error("[ops-cancel] load invoice failed", orderId, invoiceError.message);
    return { ok: false, status: 500, message: OPS_CANCEL_MESSAGES.failed };
  }

  const plan = planOpsCancel(order, invoice);
  if (!plan.ok) return { ok: false, ...friendlyOpsCancelError(null, plan.reason) };

  const { error: updateError } = await db.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  if (updateError) {
    console.error("[ops-cancel] cancel order failed", orderId, updateError.code, updateError.message);
    return { ok: false, ...friendlyOpsCancelError(null, updateError.message) };
  }

  if (order.assigned_knight_id) {
    const { data: profile } = await db
      .from("profiles")
      .select("orders_today")
      .eq("id", order.assigned_knight_id)
      .maybeSingle();
    if (profile && (profile.orders_today ?? 0) > 0) {
      await db
        .from("profiles")
        .update({ orders_today: Math.max(0, (profile.orders_today ?? 0) - 1) })
        .eq("id", order.assigned_knight_id);
    }
  }

  if (!plan.paid || plan.refundPaise <= 0) return { ok: true, refund_started: false };

  const refund = await invokeOpsRefund({ action: "trigger", order_id: orderId, note: `Cancelled by ops: ${reason}` }, actor);
  if (!refund.ok) {
    return {
      ok: true,
      refund_started: false,
      refund_message: `Order cancelled, but the refund didn't start: ${refund.message} Open the order's refund page to retry.`,
    };
  }
  return { ok: true, refund_started: true };
}
