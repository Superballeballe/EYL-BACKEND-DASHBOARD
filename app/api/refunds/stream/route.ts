import { sessionFromRequest } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tables whose changes refresh the refund views (if they are in the realtime publication). */
const WATCHED = ["cancelled_orders", "payment_reviews", "payment_refunds"] as const;

/**
 * SSE: tells open dashboard tabs that refund data changed so they refresh.
 * Notify only. It never sends, retries or records a refund.
 */
export async function GET(req: Request) {
  const session = await sessionFromRequest(req);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let closed = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data = "") => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      const notify = (table: string) => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => send("change", table), 500);
      };

      const keepalive = setInterval(() => send("ping"), 30_000);
      const db = supabaseAdmin();
      let channel = db.channel(`refunds-stream-${session.userId}-${Date.now()}`);
      for (const table of WATCHED) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => notify(table));
      }
      channel.subscribe();

      send("ready");

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (debounce) clearTimeout(debounce);
        clearInterval(keepalive);
        void db.removeChannel(channel);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
