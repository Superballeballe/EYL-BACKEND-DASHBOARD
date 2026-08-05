import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ok, serverError } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import {
  createDashboardUser,
  getInviteByToken,
  getUserByEmail,
  issueSessionResponse,
  markInviteAccepted,
} from "@/lib/server/session";

export const runtime = "nodejs";

const acceptSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).optional(),
});

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return badRequest("Missing token");

  try {
    const invite = await getInviteByToken(token);
    if (!invite || invite.accepted_at) return ok({ valid: false });
    if (new Date(invite.expires_at).getTime() < Date.now()) return ok({ valid: false, expired: true });
    return ok({ valid: true, email: invite.email, role: invite.role });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Invalid request");

  try {
    const invite = await getInviteByToken(parsed.data.token);
    if (!invite || invite.accepted_at) return badRequest("Invite is invalid or already used");
    if (new Date(invite.expires_at).getTime() < Date.now()) return badRequest("Invite has expired");

    const existing = await getUserByEmail(invite.email);
    if (existing) return badRequest("An account with this email already exists");

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createDashboardUser({
      email: invite.email,
      passwordHash,
      name: parsed.data.name ?? null,
      role: invite.role as "admin" | "operator",
      invitedBy: invite.invited_by as string,
      emailVerified: true,
    });

    await markInviteAccepted(invite.id);

    return issueSessionResponse(req, user.id, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "DUPLICATE_EMAIL") {
      return badRequest("An account with this email already exists");
    }
    return serverError(e);
  }
}
