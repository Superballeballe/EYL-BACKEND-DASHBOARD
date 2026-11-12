import { subscribeDeliveriesStream } from "@/lib/server/deliveriesStream";
import { sessionFromRequest } from "@/lib/server/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE bridge: Supabase Realtime on `deliveries` → browser EventSource. */
export async function GET(req: Request) {
  const session = await sessionFromRequest(req);
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data = "") => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      const db = supabaseAdmin();
      const keepalive = setInterval(() => send("ping"), 30_000);

      const shutdown = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        void db.removeChannel(channel);
        controller.close();
      };

      const channel = subscribeDeliveriesStream(db, session.userId, {
        change: () => send("change"),
        order: (orderId) => send("order", orderId),
        settled: (orderId) => send("settled", orderId),
        // A dead subscription would keep pinging with no events, so the order
        // sound goes quiet with nothing to show for it. End the response
        // instead: the browser's EventSource reconnects with a fresh channel.
        down: (status, err) => {
          if (closed) return;
          console.error(`[deliveries-stream] realtime ${status}; closing so the browser reconnects`, err ?? "");
          shutdown();
        },
      });

      send("ready");
      req.signal.addEventListener("abort", shutdown);
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
