import { badRequest, ok, serverError } from "@/lib/api";
import {
  deleteEmailVerification,
  getEmailVerificationByToken,
  getUserById,
  issueSessionResponse,
  markEmailVerified,
} from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return badRequest("Missing token");

  try {
    const row = await getEmailVerificationByToken(token);
    if (!row) return ok({ valid: false });
    if (new Date(row.expires_at).getTime() < Date.now()) return ok({ valid: false, expired: true });
    return ok({ valid: true });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) return badRequest("Missing token");

  try {
    const row = await getEmailVerificationByToken(token);
    if (!row) return badRequest("Invalid or expired confirmation link");
    if (new Date(row.expires_at).getTime() < Date.now()) return badRequest("Confirmation link expired");

    await markEmailVerified(row.user_id);
    await deleteEmailVerification(row.id);

    const user = await getUserById(row.user_id);
    if (!user) return badRequest("User not found");

    return issueSessionResponse(req, user.id, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    return serverError(e);
  }
}
