import { randomUUID } from "node:crypto";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { incomingOrderId, settledOrderId } from "@/lib/orderAlert";

export type DeliveriesStreamHandlers = {
  /** Any change to deliveries, orders or invoices: the page should refresh. */
  change: () => void;
  /** A customer order arrived: ring (components/NewOrderAlert.tsx). */
  order: (orderId: string) => void;
  /** That order was confirmed, given a knight or cancelled: stop ringing. */
  settled: (orderId: string) => void;
  /** The realtime subscription failed or closed; no more events will arrive. */
  down: (status: string, err?: Error) => void;
};

/**
 * The realtime channel behind one GET /api/deliveries/stream connection.
 *
 * The topic is unique per connection. realtime-js returns the existing channel
 * for a topic it already has, and adding postgres_changes listeners to a
 * joined channel throws. With a per-user topic on the shared admin client, only
 * the first stream of an operator got events: every tab opens two (the
 * Deliveries page and NewOrderAlert), so the order sound could stay silent.
 */
export function subscribeDeliveriesStream(
  db: SupabaseClient,
  userId: string,
  handlers: DeliveriesStreamHandlers,
): RealtimeChannel {
  return db
    .channel(`deliveries-stream-${userId}-${randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, (change) => {
      handlers.change();
      const incoming = incomingOrderId(change);
      if (incoming) handlers.order(incoming);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (change) => {
      handlers.change();
      const settled = settledOrderId(change);
      if (settled) handlers.settled(settled);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => handlers.change())
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        handlers.down(status, err);
      }
    });
}
