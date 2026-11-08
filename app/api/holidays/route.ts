import { z } from "zod";
import { badRequest, conflict, created, ok, serverError, unauthorized } from "@/lib/api";
import { holidayDayError } from "@/lib/holidays";
import { HOLIDAY_COLUMNS, listUpcomingHolidays } from "@/lib/server/holidays";
import { requireSessionUser } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  day: z.string(),
  note: z.string().max(200).optional(),
});

/** Upcoming closed days (today on). */
export async function GET() {
  try {
    return ok({ data: await listUpcomingHolidays(supabaseAdmin()) });
  } catch (e) {
    return serverError(e);
  }
}

/** Close a day: the app, WhatsApp bot and knight app stop taking orders for it. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return unauthorized("Sign in required");
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Pick a date (notes up to 200 characters).");
  const dayError = holidayDayError(parsed.data.day);
  if (dayError) return badRequest(dayError);

  const { data, error } = await supabaseAdmin()
    .from("service_holidays")
    .insert({ day: parsed.data.day, note: parsed.data.note?.trim() ?? "", created_by: user.email })
    .select(HOLIDAY_COLUMNS)
    .single();
  if (error?.code === "23505") return conflict("That day is already closed.");
  if (error) return serverError(error);
  return created(data);
}
