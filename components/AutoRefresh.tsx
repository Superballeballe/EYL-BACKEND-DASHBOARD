"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  AUTO_REFRESH_INTERVAL_MS,
  AUTO_REFRESH_MIN_GAP_MS,
  createAutoRefresh,
  isServerReachable,
} from "@/lib/autoRefresh";

/**
 * Keeps a server-rendered page current without a manual reload: re-fetches the
 * route's server data on a timer while the tab is visible, and at once when the
 * operator comes back to it. Works whether or not a realtime stream is alive.
 *
 * Add it only to pages where a refresh is safe. It hands every client component
 * fresh props, so a component that reloads or resets itself when its props
 * change (SalariesBoard, PlottingMapBoard) would lose unsaved input or redo
 * paid map requests on every tick.
 */
export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let checking = false;
    let unreachable = false;

    const refresh = async () => {
      if (checking) return;
      checking = true;
      const reachable = await isServerReachable({
        online: navigator.onLine,
        fetch: (url, init) => fetch(url, init),
      });
      checking = false;
      if (disposed) return;
      if (!reachable) {
        if (!unreachable) console.warn("[auto-refresh] dashboard server unreachable; holding refreshes until it answers.");
        unreachable = true;
        return;
      }
      if (unreachable) console.info("[auto-refresh] dashboard server reachable again.");
      unreachable = false;
      router.refresh();
    };

    const auto = createAutoRefresh({
      intervalMs: AUTO_REFRESH_INTERVAL_MS,
      minGapMs: AUTO_REFRESH_MIN_GAP_MS,
      onRefresh: () => void refresh(),
      visible: document.visibilityState === "visible",
    });

    const onVisibility = () => auto.setVisible(document.visibilityState === "visible");
    const onWake = () => auto.wake();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      auto.dispose();
    };
  }, [router]);

  return null;
}
