import { badRequest, ok, serverError, unauthorized } from "@/lib/api";
import { checkApiKey } from "@/lib/auth";
import { processPendingRefunds } from "@/lib/server/processRefund";
import { requireSessionUser } from "@/lib/server/session";

export const runtime = "nodejs";

/** Process all pending customer refunds (cron or manual ops trigger). */
export async function POST(req: Request) {
  const viaCron = checkApiKey(req);
  if (!viaCron) {
    try {
      await requireSessionUser();
    } catch (e) {
      if (e instanceof Error && e.message === "UNAUTHORIZED") {
        return unauthorized("Sign in required");
      }
      return serverError(e);
    }
  }

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    if (!Number.isFinite(limit) || limit <= 0 || limit > 100) {
      return badRequest("limit must be between 1 and 100");
    }

    const results = await processPendingRefunds({
      source: viaCron ? "cron" : "manual",
      limit,
    });
    const succeeded = results.filter((r) => r.ok && !r.already).length;
    const failed = results.filter((r) => !r.ok).length;
    const skipped = results.filter((r) => r.already).length;

    return ok({ processed: results.length, succeeded, failed, skipped, results });
  } catch (e) {
    return serverError(e);
  }
}
