import { badRequest, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { processCancelledOrderRefund } from "@/lib/server/processRefund";
import { requireSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  try {
    await requireSessionUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    return serverError(e);
  }

  try {
    const { id } = await params;
    const result = await processCancelledOrderRefund(id, "manual");
    if (!result.ok && result.error === "Cancelled order not found") return notFound(result.error);
    if (!result.ok) return badRequest(result.error ?? "Refund failed");
    return ok({
      ok: true,
      refund_id: result.refund_id,
      amount: result.amount,
      already: result.already ?? false,
    });
  } catch (e) {
    return serverError(e);
  }
}
