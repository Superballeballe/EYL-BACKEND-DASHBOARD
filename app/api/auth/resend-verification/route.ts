import { randomBytes } from "crypto";
import { z } from "zod";
import { badRequest, ok, serverError } from "@/lib/api";
import { resendConfigured, sendVerificationEmail, verifyEmailUrl } from "@/lib/email";
import { createEmailVerification, getUserByEmail } from "@/lib/server/session";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  if (!resendConfigured()) return badRequest("Email is not configured on this server");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Valid email is required");

  try {
    const account = await getUserByEmail(parsed.data.email);
    if (account && !account.email_verified_at) {
      const token = randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createEmailVerification(account.id, token, expiresAt);
      await sendVerificationEmail({
        to: account.email,
        name: account.name,
        verifyUrl: verifyEmailUrl(token, req),
      });
    }

    return ok({
      ok: true,
      message: "If that account exists and is unverified, we sent a new confirmation link.",
    });
  } catch (e) {
    return serverError(e);
  }
}
