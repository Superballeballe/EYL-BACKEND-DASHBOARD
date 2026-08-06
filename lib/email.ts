type ResendEmail = {
  to: string;
  subject: string;
  html: string;
};

export function resendConfigured(): boolean {
  return resendConfigError() === null;
}

/** Resend accepts `you@domain.com` or `Name <you@domain.com>`. */
export function normalizeFromEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const from = raw.trim().replace(/^["']|["']$/g, "");
  if (!from) return null;
  const plain = /^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/;
  const named = /^.+<[^\s<>]+@[^\s<>]+\.[^\s<>]+>$/;
  return plain.test(from) || named.test(from) ? from : null;
}

/** Why Resend isn't ready — null if OK. */
export function resendConfigError(): string | null {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return "RESEND_API_KEY is missing from .env. Restart the dev server after adding it.";
  }
  const raw = process.env.INVITE_FROM_EMAIL?.trim();
  if (!raw) {
    return "INVITE_FROM_EMAIL is missing from .env.";
  }
  if (!normalizeFromEmail(raw)) {
    if (!raw.includes("@")) {
      if (raw.split(/\s+/).length > 0 && raw.length < 30) {
        return 'INVITE_FROM_EMAIL was truncated (spaces in .env need quotes). Use ops@adamantiumdigital.com or "EYL Ops <ops@adamantiumdigital.com>"';
      }
      const dotFix = raw.replace(/<([^.]+)\.([^>]+)>/, "<$1@$2>");
      if (dotFix !== raw && normalizeFromEmail(dotFix)) {
        return `INVITE_FROM_EMAIL is missing @. Use: ${dotFix}`;
      }
      return "INVITE_FROM_EMAIL must be a full email, e.g. ops@adamantiumdigital.com or EYL Ops <ops@adamantiumdigital.com>";
    }
    return "INVITE_FROM_EMAIL format is invalid. Use ops@yourdomain.com or EYL Ops <ops@yourdomain.com>.";
  }
  return null;
}

function parseResendError(raw: string): string {
  try {
    const j = JSON.parse(raw) as { message?: string };
    if (j.message?.includes("from")) {
      return "Invalid INVITE_FROM_EMAIL in .env. Use ops@yourdomain.com or EYL Ops <ops@yourdomain.com> with a domain verified in Resend.";
    }
    return j.message || raw;
  } catch {
    return raw;
  }
}

export async function sendResendEmail(input: ResendEmail & { text?: string }): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = normalizeFromEmail(process.env.INVITE_FROM_EMAIL);

  if (!apiKey || !from) {
    return {
      sent: false,
      reason:
        "Set RESEND_API_KEY and INVITE_FROM_EMAIL in .env (e.g. EYL Ops <ops@yourdomain.com>). Restart the server after editing.",
    };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { sent: false, reason: parseResendError(err || `Resend error ${res.status}`) };
  }

  return { sent: true };
}

export function appUrl(req: Request, path: string): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  const isLocalConfigured =
    !configured || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);

  let base: string;
  if (!isLocalConfigured && configured) {
    base = configured;
  } else {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ??
      req.headers.get("host")?.trim();
    base = proto && host ? `${proto}://${host}` : new URL(req.url).origin;
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function inviteAcceptUrl(token: string, req: Request): string {
  return appUrl(req, `/accept-invite?token=${encodeURIComponent(token)}`);
}

export function verifyEmailUrl(token: string, req: Request): string {
  return appUrl(req, `/verify-email?token=${encodeURIComponent(token)}`);
}

export async function sendInviteEmail(input: {
  to: string;
  inviteUrl: string;
  invitedByName: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const inviter = input.invitedByName?.trim() || "An EYL admin";
  return sendResendEmail({
    to: input.to,
    subject: "You're invited to EYL Delivery Dashboard",
    html: `
      <p>${inviter} invited you to the EYL Delivery operations dashboard.</p>
      <p><a href="${input.inviteUrl}">Accept invite and set your password</a></p>
      <p>This link expires in 7 days.</p>
    `,
  });
}

export async function sendVerificationEmail(input: {
  to: string;
  name: string | null;
  verifyUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const who = input.name?.trim() || "there";
  return sendResendEmail({
    to: input.to,
    subject: "Confirm your EYL Delivery account",
    html: `
      <p>Hi ${who},</p>
      <p>Confirm your email to access the EYL Delivery dashboard:</p>
      <p><a href="${input.verifyUrl}">${input.verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
    text: `Hi ${who},\n\nConfirm your EYL Delivery account:\n${input.verifyUrl}\n\nLink expires in 24 hours.`,
  });
}
