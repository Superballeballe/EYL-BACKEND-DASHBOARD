import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError, unauthorized } from "@/lib/api";
import { verifyPassword } from "@/lib/password";
import { countDashboardUsers, getUserWithPassword, issueSessionResponse } from "@/lib/server/session";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return badRequest("Email and password are required");

  const secret = process.env.SESSION_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "SESSION_SECRET is not configured" }, { status: 500 });
  }

  try {
    const count = await countDashboardUsers();
    if (count === 0) {
      return NextResponse.json({ error: "Setup required", setupRequired: true }, { status: 403 });
    }

    const row = await getUserWithPassword(parsed.data.email);
    if (!row || !row.active) return unauthorized("Incorrect email or password");

    const valid = await verifyPassword(parsed.data.password, row.password_hash);
    if (!valid) return unauthorized("Incorrect email or password");

    if (!row.email_verified_at) {
      return NextResponse.json(
        { error: "Confirm your email before signing in.", emailNotVerified: true },
        { status: 403 },
      );
    }

    return issueSessionResponse(req, row.id, {
      ok: true,
      user: { id: row.id, email: row.email, name: row.name, role: row.role },
    });
  } catch (e) {
    return serverError(e);
  }
}
