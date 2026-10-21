"use client";

import { useEffect } from "react";
import { shouldChime } from "@/lib/orderAlert";

/** Two rising notes, synthesised so there is no audio file to ship or cache. */
const CHIME_NOTES_HZ = [880, 1320];
const NOTE_SPACING_S = 0.18;
const NOTE_LENGTH_S = 0.45;

function playChime(ctx: AudioContext) {
  const start = ctx.currentTime;
  CHIME_NOTES_HZ.forEach((hz, i) => {
    const at = start + i * NOTE_SPACING_S;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_LENGTH_S);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + NOTE_LENGTH_S);
  });
}

/**
 * Plays a chime whenever a customer order (app or WhatsApp) arrives, on any
 * dashboard page. Listens for the `order` event on the deliveries stream.
 *
 * Browsers keep audio muted until the operator has clicked or typed on the
 * page, so the audio context is unlocked on the first such gesture. An order
 * that lands before that is logged instead of heard.
 */
export default function NewOrderAlert() {
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let lastChimeAt: number | null = null;
    let warnedMuted = false;

    const unlock = () => {
      ctx ??= new AudioContext();
      if (ctx.state === "suspended") void ctx.resume();
      return ctx;
    };

    const onOrder = () => {
      const now = Date.now();
      if (!shouldChime(lastChimeAt, now)) return;
      lastChimeAt = now;
      const audio = unlock();
      if (audio.state !== "running") {
        if (!warnedMuted) {
          console.warn("[order-alert] new order arrived, but sound is blocked until you click or type on the page.");
          warnedMuted = true;
        }
        return;
      }
      playChime(audio);
    };

    const stream = new EventSource("/api/deliveries/stream");
    stream.addEventListener("order", onOrder);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    return () => {
      stream.close();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void ctx?.close();
    };
  }, []);

  return null;
}
