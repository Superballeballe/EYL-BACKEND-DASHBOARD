import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api";
import {
  countActiveAdmins,
  deleteDashboardUser,
  getUserById,
  requireAdmin,
  updateDashboardUserRole,
} from "@/lib/server/session";
import { isTeamRole, roleChangeError } from "@/lib/teamRoles";

export const runtime = "nodejs";

/** Change a teammate's role: { role: "admin" | "operator" }. Admins only. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const role = body?.role;
    if (!isTeamRole(role)) return badRequest("Role must be admin or operator.");

    const target = await getUserById(id);
    if (!target) return notFound("User not found");

    const activeAdmins = target.role === "admin" ? await countActiveAdmins() : 0;
    const refusal = roleChangeError({ actorId: admin.id, target, role, activeAdmins });
    if (refusal) return badRequest(refusal);

    const user = await updateDashboardUserRole(id, role);
    return ok({ user });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Admin access required");
    return serverError(e);
  }
}

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
