import { badRequest, notFound, ok, serverError, unauthorized } from "@/lib/api";
import { requireSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ day: string }> };

/** Open a closed day again. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await requireSessionUser();
  } catch {
    return unauthorized("Sign in required");
  }
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return badRequest("Pick a valid date.");
  const { data, error } = await supabaseAdmin().from("service_holidays").delete().eq("day", day).select("day");
  if (error) return serverError(error);
  if (!data?.length) return notFound("That day isn't closed.");
  return ok({ day });
}
