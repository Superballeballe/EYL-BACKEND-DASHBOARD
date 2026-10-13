import { z } from "zod";
import { badRequest, ok, unauthorized } from "@/lib/api";
import { resolveNoteError } from "@/lib/refunds";
import { invokeOpsRefund, opsActor } from "@/lib/server/opsRefund";
import { requireSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  review_action: z.enum(["refund", "resolve"]),
  note: z.string().trim().max(500).optional(),
  reference: z.string().trim().max(120).optional(),
});

/**
 * Ops decision on a payment review (wrong amount / duplicate / other):
 * refund exactly that payment, or resolve it with a note. Always through
 * ops-refund "review", with the signed-in user as actor.
 */
export async function POST(req: Request, { params }: Ctx) {
  let user;
  try {
    user = await requireSessionUser();
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") return unauthorized("Sign in required");
    console.error("[reviews] session failed", e);
    return ok({ error: "Couldn't check your sign-in. Refresh and try again." }, { status: 500 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Choose refund or resolve.");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return badRequest("That review id isn't valid.");

  const { review_action, note, reference } = parsed.data;
  if (review_action === "resolve") {
    const noteError = resolveNoteError(note);
    if (noteError) return badRequest(noteError);
  }

  const result = await invokeOpsRefund(
    {
      action: "review",
      review_id: id,
      review_action,
      ...(note ? { note } : {}),
      ...(reference ? { reference } : {}),
    },
    opsActor(user),
  );
  if (!result.ok) return ok({ error: result.message, code: result.code }, { status: result.status });
  return ok(result);
}
