/**
 * Pure helpers for the timed page refresh (see components/AutoRefresh.tsx).
 * No browser-only imports here so it can be unit-tested.
 */

/** How often a visible page re-fetches its server data. */
export const AUTO_REFRESH_INTERVAL_MS = 20_000;
/** Coming back to the tab refreshes at once, unless one ran this recently. */
export const AUTO_REFRESH_MIN_GAP_MS = 5_000;
/** Cheap, public, no database: only answers "is the dashboard server there?". */
export const AUTO_REFRESH_PROBE_URL = "/api/health";
export const AUTO_REFRESH_PROBE_TIMEOUT_MS = 5_000;

type Timers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/**
 * Fires `onRefresh` every `intervalMs` while the page is visible.
 * - Hidden: the timer stops, so a background tab costs nothing.
 * - `setVisible(true)` / `wake()`: fires at once if the last run is older than
 *   `minGapMs` (the page may be stale), otherwise keeps the running cadence.
 * The page counts as fresh when the scheduler is created (it was just rendered).
 */
export function createAutoRefresh(opts: {
  intervalMs: number;
  minGapMs: number;
  onRefresh: () => void;
  visible?: boolean;
  now?: () => number;
  timers?: Timers;
}) {
  const now = opts.now ?? (() => Date.now());
  const timers: Timers = opts.timers ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  };
  let handle: unknown = null;
  let visible = opts.visible ?? true;
  let lastRunAt = now();
  let disposed = false;

  const cancel = () => {
    if (handle !== null) timers.clearTimeout(handle);
    handle = null;
  };

  const schedule = (delayMs: number) => {
    cancel();
    handle = timers.setTimeout(() => {
      handle = null;
      fire();
    }, delayMs);
  };

  const fire = () => {
    if (disposed || !visible) return;
    lastRunAt = now();
    schedule(opts.intervalMs);
    opts.onRefresh();
  };

  if (visible) schedule(opts.intervalMs);

  return {
    setVisible(next: boolean) {
      if (disposed || next === visible) return;
      visible = next;
      if (!next) {
        cancel();
        return;
      }
      const elapsed = now() - lastRunAt;
      if (elapsed >= opts.minGapMs) fire();
      else schedule(Math.max(0, opts.intervalMs - elapsed));
    },
    wake() {
      if (disposed || !visible) return;
      if (now() - lastRunAt >= opts.minGapMs) fire();
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}

/**
 * Is the dashboard server answering? Asked before every timed refresh, because
 * Next turns a failed refresh request into a full page load, which would swap a
 * working screen for the browser's error page during a network or server blip.
 */
export async function isServerReachable(opts: {
  online: boolean;
  fetch: (url: string, init: { cache: "no-store"; signal: AbortSignal }) => Promise<{ ok: boolean }>;
  timeoutMs?: number;
}): Promise<boolean> {
  if (!opts.online) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? AUTO_REFRESH_PROBE_TIMEOUT_MS);
  try {
    const res = await opts.fetch(AUTO_REFRESH_PROBE_URL, { cache: "no-store", signal: controller.signal });
    return res.ok;
  } catch {
    // A rejected fetch is the answer "not reachable", not an error to report.
    return false;
  } finally {
    clearTimeout(timer);
  }
}
