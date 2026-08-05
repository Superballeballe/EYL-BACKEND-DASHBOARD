import { z } from "zod";
import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import { verifyPassword, hashPassword } from "@/lib/password";
import { getSessionUser, getUserWithPassword, updatePasswordHash } from "@/lib/server/session";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message || "Invalid data");

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return badRequest("New password must be different from your current password.");
  }

  try {
    const row = await getUserWithPassword(user.email);
    if (!row?.active) return unauthorized();

    const valid = await verifyPassword(parsed.data.currentPassword, row.password_hash);
    if (!valid) return badRequest("Current password is incorrect.");

    await updatePasswordHash(user.id, await hashPassword(parsed.data.newPassword));
    return ok({ ok: true, message: "Password updated." });
  } catch (e) {
    return serverError(e);
  }
}
