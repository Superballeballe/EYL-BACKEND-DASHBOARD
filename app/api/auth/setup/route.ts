import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, ok, serverError } from "@/lib/api";
import { hashPassword } from "@/lib/password";
import {
  countDashboardUsers,
  createDashboardUser,
  issueSessionResponse,
} from "@/lib/server/session";

export const runtime = "nodejs";

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).optional(),
});

export async function GET() {
  try {
    const count = await countDashboardUsers();
    return ok({ setupRequired: count === 0 });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.errors[0]?.message || "Invalid setup data");
  }

  const secret = process.env.SESSION_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "SESSION_SECRET is not configured" }, { status: 500 });
  }

  try {
    const count = await countDashboardUsers();
    if (count > 0) return badRequest("Setup already completed");

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await createDashboardUser({
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name ?? null,
      role: "admin",
      emailVerified: true,
    });

    return issueSessionResponse(req, user.id, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    return serverError(e);
  }
}
