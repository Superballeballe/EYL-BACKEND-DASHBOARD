"use client";

import { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { ORDER_ALERT_RING_MS } from "@/lib/orderAlert";

const ALERT_SOUND = "/sounds/new-order.mp3";

/**
 * Rings on any dashboard page when a customer order (app or WhatsApp) arrives.
 * The sound loops for up to `ORDER_ALERT_RING_MS` per order and stops early
 * once the order is confirmed, given a knight or cancelled; while any order is
 * still ringing, it keeps looping. Listens for `order` / `settled` on the
 * deliveries stream. It keeps ringing in a background tab.
 *
 * Browsers keep audio muted after every page load until the operator clicks or
 * types on the page. Until then this shows a "sound is off" notice, and the
 * first click or key press turns the sound on (and rings for any order that is
 * still waiting).
 */
export default function NewOrderAlert() {
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [missedOrder, setMissedOrder] = useState(false);
  const unlockRef = useRef<() => void>(() => {});

  useEffect(() => {
    const audio = new Audio(ALERT_SOUND);
    audio.loop = true;
    const ringing = new Map<string, ReturnType<typeof setTimeout>>();
    let blocked = false;

    const setBlocked = (value: boolean) => {
      blocked = value;
      setSoundBlocked(value);
      if (!value) setMissedOrder(false);
    };

    // Known up front where the browser says so; otherwise the first play() tells.
    if ("userActivation" in navigator && !navigator.userActivation.hasBeenActive) setBlocked(true);

    const stop = (orderId: string) => {
      clearTimeout(ringing.get(orderId));
      if (!ringing.delete(orderId) || ringing.size > 0) return;
      audio.pause();
      audio.currentTime = 0;
    };

    const play = () =>
      audio.play().then(
        () => setBlocked(false),
        (err: DOMException) => {
          // AbortError: the order settled before playback started.
          if (err.name === "AbortError") return;
          if (err.name === "NotAllowedError") {
            setBlocked(true);
            if (ringing.size > 0) setMissedOrder(true);
            return;
          }
          console.error("[order-alert] could not play the alert sound:", err);
        },
      );

    // A click or key press allows audio for the rest of this page's life.
    // Start it then: audibly if an order is still ringing, otherwise muted and
    // paused at once, which also unlocks the element on Safari.
    const unlock = () => {
      if (!blocked) return;
      const silent = ringing.size === 0;
      audio.muted = silent;
      void play().finally(() => {
        if (silent && ringing.size === 0) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio.muted = false;
      });
    };
    unlockRef.current = unlock;

    const onOrder = (e: MessageEvent<string>) => {
      const orderId = e.data;
      clearTimeout(ringing.get(orderId));
      ringing.set(orderId, setTimeout(() => stop(orderId), ORDER_ALERT_RING_MS));
      void play();
    };

    const onSettled = (e: MessageEvent<string>) => stop(e.data);

    const stream = new EventSource("/api/deliveries/stream");
    stream.addEventListener("order", onOrder);
    stream.addEventListener("settled", onSettled);
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);

    return () => {
      stream.close();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      ringing.forEach((timer) => clearTimeout(timer));
      audio.pause();
    };
  }, []);

  if (!soundBlocked) return null;
  return (
    <Alert
      severity={missedOrder ? "error" : "warning"}
      role="alert"
      sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1400, maxWidth: 420, boxShadow: 3 }}
      action={
        <Button color="inherit" size="small" onClick={() => unlockRef.current()}>
          Turn on sound
        </Button>
      }
    >
      {missedOrder
        ? "A new order arrived, but the order sound is off."
        : "The new-order sound is off until you click anywhere on this page."}
    </Alert>
  );
}
