import { friendlyOpsCancelError } from "@/lib/refunds";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Server-only: cancel an app order as ops. The ONLY place the dashboard
 * writes an app-order cancellation.
 *
 * public.ops_cancel_order(p_order_id, p_reason, p_actor) (EYL-APP migration
 * 20261012190000, service role only; docs/payment-safety.md "ops_cancel_order")
 * does it in one transaction: refuses after pickup, cancels the order and its
 * deliveries row, releases the knight, writes cancelled_orders with no fee,
 * and for a paid order queues a 100% refund that the DB worker sends. It is
 * idempotent (already_cancelled: true). The dashboard never computes a
 * refund amount and never inserts cancelled_orders.
 */
export type OpsCancelResult =
  | {
      ok: true;
      already_cancelled: boolean;
      was_confirmed: boolean | null;
      refund_status: string | null;
      refund_amount_paise: number | null;
    }
  | { ok: false; status: 400 | 404 | 409 | 500 | 503; message: string };

type Reply = {
  ok?: boolean;
  code?: string;
  message?: string;
  already_cancelled?: boolean;
  was_confirmed?: boolean;
  refund_status?: string;
  refund_amount_paise?: number;
};

function isMissingFunction(error: { code?: string | null; message?: string | null }) {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

export async function opsCancelAppOrder(orderId: string, reason: string, actor: string): Promise<OpsCancelResult> {
  const { data, error } = await supabaseAdmin().rpc("ops_cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
    p_actor: actor,
  });

  if (error) {
    console.error("[ops-cancel] ops_cancel_order failed", orderId, error.code, error.message);
    if (isMissingFunction(error)) {
      return {
        ok: false,
        status: 503,
        message: "Cancelling app orders needs the latest backend update. Ask an admin to apply it, then try again.",
      };
    }
    return { ok: false, ...friendlyOpsCancelError(null, error.message) };
  }

  const reply = (data ?? {}) as Reply;
  if (reply.ok !== true) {
    console.error("[ops-cancel] ops_cancel_order refused", orderId, reply.code);
    return { ok: false, ...friendlyOpsCancelError(reply.code, reply.message) };
  }
  return {
    ok: true,
    already_cancelled: Boolean(reply.already_cancelled),
    was_confirmed: typeof reply.was_confirmed === "boolean" ? reply.was_confirmed : null,
    refund_status: reply.refund_status ?? null,
    refund_amount_paise: typeof reply.refund_amount_paise === "number" ? reply.refund_amount_paise : null,
  };
}
