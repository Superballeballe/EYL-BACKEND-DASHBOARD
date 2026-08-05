import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ok, serverError } from "@/lib/api";
import { resendConfigError, sendVerificationEmail, verifyEmailUrl } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import {
  countDashboardUsers,
  createDashboardUser,
  createEmailVerification,
  getUserByEmail,
  updatePasswordHash,
} from "@/lib/server/session";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  const configErr = resendConfigError();
  if (configErr) {
    return NextResponse.json({ error: configErr }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Invalid sign-up data");

  try {
    const email = parsed.data.email.trim().toLowerCase();
    const existing = await getUserByEmail(email);

    if (existing?.email_verified_at) {
      return badRequest("An account with this email already exists. Sign in instead.");
    }

    const count = await countDashboardUsers();
    const role = count === 0 ? "admin" : "operator";
    const passwordHash = await hashPassword(parsed.data.password);

    let userId: string;
    let userName: string | null;
    let existingUnverified = false;

    if (existing && !existing.email_verified_at) {
      existingUnverified = true;
      userId = existing.id;
      userName = existing.name;
      await updatePasswordHash(userId, passwordHash);
    } else {
      const user = await createDashboardUser({
        email,
        passwordHash,
        name: parsed.data.name ?? null,
        role,
        emailVerified: false,
      });
      userId = user.id;
      userName = user.name;
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createEmailVerification(userId, token, expiresAt);

    const mail = await sendVerificationEmail({
      to: email,
      name: userName,
      verifyUrl: verifyEmailUrl(token, req),
    });

    if (!mail.sent) {
      return NextResponse.json(
        { error: mail.reason || "Could not send confirmation email" },
        { status: 502 },
      );
    }

    return ok({
      ok: true,
      message: existingUnverified
        ? "Confirmation email sent again. Check your inbox (and spam)."
        : "Check your email for a confirmation link.",
      role: existing?.role ?? role,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "DUPLICATE_EMAIL") {
      return badRequest("An account with this email already exists. Sign in instead.");
    }
    return serverError(e);
  }
}
