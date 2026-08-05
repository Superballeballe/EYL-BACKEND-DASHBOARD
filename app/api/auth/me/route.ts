import { ok, serverError, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (e) {
    return serverError(e);
  }
}
