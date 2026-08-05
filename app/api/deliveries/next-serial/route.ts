import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextSerial } from "@/lib/server/serial";
import { badRequest, ok, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const mode = new URL(req.url).searchParams.get("mode");
    if (mode && mode !== "online" && mode !== "b2b") {
      return badRequest("mode must be online or b2b");
    }
    const result = await nextSerial(
      supabaseAdmin(),
      (mode as "online" | "b2b") ?? "online",
    );
    return ok(result);
  } catch (e) {
    return serverError(e);
  }
}
