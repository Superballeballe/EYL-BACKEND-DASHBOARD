import { z } from "zod";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api";
import { manualRefundAction } from "@/lib/refunds";
import { invokeOpsRefund, opsActor } from "@/lib/server/opsRefund";
import { requireSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ orderId: string }> };

const schema = z.object({ note: z.string().trim().max(500).optional() });

/**
 * Manual refund of one order, through ops-refund. Allowed only where nothing
 * automatic will happen (lib/refunds manualRefundAction): a failed refund
 * (retry), a paid order after pickup, or a paid cancelled order whose
 * refund was never queued.
 */
export async function POST(req: Request, { params }: Ctx) {
  let user;
  try {
    user = await requireSessionUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    console.error("[order-refund] session failed", e);
    return ok({ error: "Couldn't check your sign-in. Refresh and try again." }, { status: 500 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest("Keep the note under 500 characters.");
  const { orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return badRequest("That order id isn't valid.");

  const db = supabaseAdmin();
  const [order, invoice, cancelled] = await Promise.all([
    db.from("orders").select("id, status").eq("id", orderId).maybeSingle(),
    db.from("invoices").select("payment_status").eq("order_id", orderId).maybeSingle(),
    db.from("cancelled_orders").select("refund_status").eq("order_id", orderId).maybeSingle(),
  ]);
  const loadError = order.error ?? invoice.error ?? cancelled.error;
  if (loadError) {
    console.error("[order-refund] load failed", orderId, loadError.message);
    return ok({ error: "Couldn't load this order. Refresh and try again." }, { status: 500 });
  }
  if (!order.data && !cancelled.data) return notFound("Order not found");

  const action = manualRefundAction({
    orderStatus: order.data?.status ?? "cancelled",
    paymentStatus: invoice.data?.payment_status ?? null,
    refundStatus: cancelled.data?.refund_status ?? null,
  });
  if (!action) {
    return badRequest("This order is refunded automatically, or has nothing to refund. Refresh to see its status.");
  }

  const result = await invokeOpsRefund(
    {
      action: action === "retry" ? "retry" : "trigger",
      order_id: orderId,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    },
    opsActor(user),
  );
  if (!result.ok) return ok({ error: result.message, code: result.code }, { status: result.status });
  return ok(result);
}
