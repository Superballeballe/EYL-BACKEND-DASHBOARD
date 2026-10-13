import { badRequest, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { invokeOpsRefund, opsActor } from "@/lib/server/opsRefund";
import { requireSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Retry a FAILED cancellation refund (ops click). Goes through ops-refund
 * "retry": same idempotent path as the DB worker (lease, idempotency key
 * cancelled_orders.id, payment_refunds claim). Pending / processing refunds
 * belong to the DB worker and are refused here.
 */
export async function POST(_req: Request, { params }: Ctx) {
  let user;
  try {
    user = await requireSessionUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    return serverError(e);
  }

  try {
    const { id } = await params;
    const { data: row, error } = await supabaseAdmin()
      .from("cancelled_orders")
      .select("id, order_id, refund_status")
      .eq("id", id)
      .maybeSingle();
    if (error) return serverError(error);
    if (!row) return notFound("Cancelled order not found");
    if (!row.order_id) return badRequest("The original order is missing.");
    if (row.refund_status !== "failed") {
      return badRequest("Only a failed refund can be retried here. Queued refunds are sent automatically.");
    }

    const result = await invokeOpsRefund({ action: "retry", order_id: row.order_id }, opsActor(user));
    if (!result.ok) return ok({ error: result.message, code: result.code }, { status: result.status });
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
