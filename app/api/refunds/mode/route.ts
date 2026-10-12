import { z } from "zod";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api";
import { modeReasonError } from "@/lib/refunds";
import { opsActor } from "@/lib/server/opsRefund";
import { requireAdmin } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  mode: z.enum(["live", "dry_run", "off"]),
  reason: z.string(),
});

/**
 * Admin only: change AUTO_REFUND_MODE via ops_set_auto_refund_mode (audited
 * in refund_audit_log as service:<admin email> via p_actor).
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden("Only admins can change the refund mode.");
    console.error("[refund-mode] session failed", e);
    return ok({ error: "Couldn't check your sign-in. Refresh and try again." }, { status: 500 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Choose live, dry run or off.");
  const reasonError = modeReasonError(parsed.data.reason);
  if (reasonError) return badRequest(reasonError);

  const { data, error } = await supabaseAdmin().rpc("ops_set_auto_refund_mode", {
    p_mode: parsed.data.mode,
    p_note: parsed.data.reason.trim(),
    p_actor: opsActor(user),
  });
  if (error) {
    console.error("[refund-mode] rpc failed", error.code, error.message);
    return ok({ error: "Couldn't change the mode. Check that the backend update is deployed, then try again." }, { status: 500 });
  }
  const reply = (data ?? {}) as { ok?: boolean; code?: string; message?: string; from?: string; mode?: string };
  if (reply.ok !== true) {
    console.error("[refund-mode] refused", reply.code);
    return badRequest(reply.message || "The mode was not changed.");
  }
  return ok({ ok: true, from: reply.from ?? null, mode: reply.mode ?? parsed.data.mode });
}
