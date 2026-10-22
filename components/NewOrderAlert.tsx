"use client";

import { useEffect } from "react";
import { ORDER_ALERT_RING_MS } from "@/lib/orderAlert";

const ALERT_SOUND = "/sounds/new-order.mp3";

/**
 * Rings on any dashboard page when a customer order (app or WhatsApp) arrives.
 * The sound loops for up to `ORDER_ALERT_RING_MS` per order and stops early
 * once the order is confirmed, given a knight or cancelled; while any order is
 * still ringing, it keeps looping. Listens for `order` / `settled` on the
 * deliveries stream.
 *
 * Browsers keep audio muted until the operator has clicked or typed on the
 * page. An order that lands before that is logged instead of heard.
 */
export default function NewOrderAlert() {
  useEffect(() => {
    const audio = new Audio(ALERT_SOUND);
    audio.loop = true;
    const ringing = new Map<string, ReturnType<typeof setTimeout>>();
    let warnedMuted = false;

    const stop = (orderId: string) => {
      clearTimeout(ringing.get(orderId));
      if (!ringing.delete(orderId) || ringing.size > 0) return;
      audio.pause();
      audio.currentTime = 0;
    };

    const onOrder = (e: MessageEvent<string>) => {
      const orderId = e.data;
      clearTimeout(ringing.get(orderId));
      ringing.set(orderId, setTimeout(() => stop(orderId), ORDER_ALERT_RING_MS));
      audio.play().catch((err: DOMException) => {
        // AbortError: the order settled before playback started.
        if (err.name === "AbortError") return;
        if (err.name !== "NotAllowedError") {
          console.error("[order-alert] could not play the alert sound:", err);
        } else if (!warnedMuted) {
          console.warn("[order-alert] new order arrived, but sound is blocked until you click or type on the page.");
          warnedMuted = true;
        }
      });
    };

    const onSettled = (e: MessageEvent<string>) => stop(e.data);

    const stream = new EventSource("/api/deliveries/stream");
    stream.addEventListener("order", onOrder);
    stream.addEventListener("settled", onSettled);

    return () => {
      stream.close();
      ringing.forEach((timer) => clearTimeout(timer));
      audio.pause();
    };
  }, []);

  return null;
}
