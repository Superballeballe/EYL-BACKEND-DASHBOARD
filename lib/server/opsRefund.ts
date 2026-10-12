import { FunctionsHttpError } from "@supabase/supabase-js";
import { readOpsRefundError, type OpsRefundError } from "@/lib/refunds";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Server-only: call the ops-refund edge function with the service-role key.
 * The service key carries no identity, so every call names the signed-in
 * dashboard user as `actor` (the function logs it as service:<actor> in
 * refund_audit_log).
 *
 * This is the dashboard's ONLY way to move money. It is called from explicit
 * ops clicks (payment reviews, refund retry), never from a stream or cron.
 */
export type OpsRefundBody =
  | { action: "retry" | "trigger"; order_id: string; note?: string }
  | { action: "resolve"; order_id: string; note: string; reference?: string }
  | { action: "manual"; order_id: string; note: string; amount_paise?: number }
  | {
      action: "review";
      review_id: string;
      review_action: "refund" | "resolve";
      note?: string;
      reference?: string;
    };

export type OpsRefundResult = ({ ok: true } & Record<string, unknown>) | OpsRefundError;

export async function invokeOpsRefund(body: OpsRefundBody, actor: string): Promise<OpsRefundResult> {
  const { data, error } = await supabaseAdmin().functions.invoke("ops-refund", {
    body: { ...body, actor },
  });

  if (error) {
    let status = 500;
    let payload: unknown = null;
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      status = error.context.status;
      try {
        payload = await error.context.json();
      } catch {
        payload = null;
      }
    }
    const parsed = readOpsRefundError(payload, status);
    console.error("[ops-refund] call failed", body.action, status, parsed.code, error.message);
    return parsed;
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.ok !== true) {
    const parsed = readOpsRefundError(result, 400);
    console.error("[ops-refund] refused", body.action, parsed.code);
    return parsed;
  }
  return { ...result, ok: true };
}

/** Audit name for the signed-in ops user. */
export function opsActor(user: { email: string }) {
  return user.email;
}
