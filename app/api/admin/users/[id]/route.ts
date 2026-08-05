import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api";
import {
  countActiveAdmins,
  deleteDashboardUser,
  getUserById,
  requireAdmin,
} from "@/lib/server/session";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;

    if (id === admin.id) return badRequest("You cannot remove your own account.");

    const target = await getUserById(id);
    if (!target) return notFound("User not found");

    if (target.role === "admin") {
      const admins = await countActiveAdmins();
      if (admins <= 1) return badRequest("Cannot remove the last admin.");
    }

    await deleteDashboardUser(id);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Admin access required");
    return serverError(e);
  }
}
