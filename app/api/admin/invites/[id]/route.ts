import { notFound, ok, serverError, unauthorized, forbidden } from "@/lib/api";
import { deleteInvite, getPendingInviteById, requireAdmin } from "@/lib/server/session";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    const invite = await getPendingInviteById(id);
    if (!invite) return notFound("Invite not found or already used");

    await deleteInvite(id);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Admin access required");
    return serverError(e);
  }
}
