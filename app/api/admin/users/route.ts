import { randomBytes } from "crypto";
import { z } from "zod";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api";
import { inviteAcceptUrl, sendInviteEmail } from "@/lib/email";
import {
  createInvite,
  getPendingInviteByEmail,
  getUserByEmail,
  listDashboardUsers,
  listPendingInvites,
  requireAdmin,
} from "@/lib/server/session";

export const runtime = "nodejs";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "operator"]).default("operator"),
});

export async function GET() {
  try {
    await requireAdmin();
    const [users, invites] = await Promise.all([listDashboardUsers(), listPendingInvites()]);
    return ok({ users, invites });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Admin access required");
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Valid email is required");

  try {
    const admin = await requireAdmin();
    const email = parsed.data.email.trim().toLowerCase();

    const existing = await getUserByEmail(email);
    if (existing) return badRequest("A user with this email already exists");

    const pending = await getPendingInviteByEmail(email);
    if (pending) return badRequest("An invite for this email is already pending");

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await createInvite({
      email,
      role: parsed.data.role,
      invitedBy: admin.id,
      token,
      expiresAt,
    });

    const inviteUrl = inviteAcceptUrl(token, req);
    const mail = await sendInviteEmail({
      to: email,
      inviteUrl,
      invitedByName: admin.name,
    });

    return ok({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
      },
      inviteUrl,
      emailSent: mail.sent,
      emailNote: mail.sent ? undefined : mail.reason,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Admin access required");
    return serverError(e);
  }
}
