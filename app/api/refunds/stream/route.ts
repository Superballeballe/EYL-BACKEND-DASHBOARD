import { sessionFromRequest } from "@/lib/server/session";
import { processPendingRefunds } from "@/lib/server/processRefund";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE queue: watch pending refunds and auto-process when cancellations arrive. */
export async function GET(req: Request) {
  const session = await sessionFromRequest(req);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let closed = false;
  let processing = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data = "") => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      const runQueue = async () => {
        if (processing || closed) return;
        processing = true;
        try {
          const results = await processPendingRefunds({ source: "auto", limit: 10 });
          const touched = results.filter((r) => r.ok).length;
          if (touched > 0) {
            send("processed", JSON.stringify({ count: touched, results }));
          }
          send("change");
        } catch (err) {
          send("error", err instanceof Error ? err.message : "refund queue failed");
        } finally {
          processing = false;
        }
      };

      const schedule = () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          void runQueue();
        }, 500);
      };

      const keepalive = setInterval(() => send("ping"), 30_000);
      const db = supabaseAdmin();
      const channel = db
        .channel(`refunds-stream-${session.userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cancelled_orders" },
          () => schedule(),
        )
        .subscribe();

      send("ready");
      void runQueue();

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
