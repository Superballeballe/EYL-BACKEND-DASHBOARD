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

      const keepalive = setInterval(() => send("ping"), 30_000);
      const db = supabaseAdmin();
      const channel = db
        .channel(`deliveries-stream-${session.userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "deliveries" },
          () => send("change"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => send("change"),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "invoices" },
          () => send("change"),
        )
        .subscribe();

      send("ready");

      req.signal.addEventListener("abort", () => {
        closed = true;
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
