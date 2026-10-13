import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTO_REFRESH_PROBE_URL, createAutoRefresh, isServerReachable } from "./autoRefresh";

/** Fake clock: `advance(ms)` runs every timer that falls due, in order. */
function fakeClock() {
  let time = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => time,
    timers: {
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++;
        pending.set(id, { at: time + ms, fn });
        return id;
      },
      clearTimeout: (handle: unknown) => {
        pending.delete(handle as number);
      },
    },
    advance(ms: number) {
      const end = time + ms;
      for (;;) {
        const due = [...pending.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        pending.delete(due[0]);
        time = due[1].at;
        due[1].fn();
      }
      time = end;
    },
    pendingCount: () => pending.size,
  };
}

function setup(visible = true) {
  const clock = fakeClock();
  let runs = 0;
  const auto = createAutoRefresh({
    intervalMs: 20_000,
    minGapMs: 5_000,
    onRefresh: () => {
      runs += 1;
    },
    visible,
    now: clock.now,
    timers: clock.timers,
  });
  return { clock, auto, runs: () => runs };
}

describe("timed page refresh", () => {
  it("refreshes once per interval while the page is visible", () => {
    const { clock, runs } = setup();
    clock.advance(19_999);
    assert.equal(runs(), 0);
    clock.advance(1);
    assert.equal(runs(), 1);
    clock.advance(60_000);
    assert.equal(runs(), 4);
  });

  it("does nothing while the tab is hidden", () => {
    const { clock, auto, runs } = setup();
    auto.setVisible(false);
    clock.advance(10 * 60_000);
    assert.equal(runs(), 0);
    assert.equal(clock.pendingCount(), 0);
  });

  it("refreshes at once when a stale tab becomes visible, then resumes the interval", () => {
    const { clock, auto, runs } = setup();
    auto.setVisible(false);
    clock.advance(10 * 60_000);
    auto.setVisible(true);
    assert.equal(runs(), 1);
    clock.advance(20_000);
    assert.equal(runs(), 2);
  });

  it("keeps the cadence when the tab was hidden only briefly", () => {
    const { clock, auto, runs } = setup();
    clock.advance(20_000);
    assert.equal(runs(), 1);
    clock.advance(1_000);
    auto.setVisible(false);
    clock.advance(2_000);
    auto.setVisible(true);
    assert.equal(runs(), 1, "3s after the last refresh is still fresh");
    clock.advance(16_999);
    assert.equal(runs(), 1);
    clock.advance(1);
    assert.equal(runs(), 2, "next refresh lands 20s after the previous one");
  });

  it("starts hidden without a timer and refreshes on first show", () => {
    const { clock, auto, runs } = setup(false);
    assert.equal(clock.pendingCount(), 0);
    clock.advance(30_000);
    auto.setVisible(true);
    assert.equal(runs(), 1);
  });

  it("wake() refreshes a stale page but not one refreshed moments ago", () => {
    const { clock, auto, runs } = setup();
    clock.advance(4_999);
    auto.wake();
    assert.equal(runs(), 0);
    clock.advance(1);
    auto.wake();
    assert.equal(runs(), 1);
    auto.wake();
    assert.equal(runs(), 1, "a burst of focus events is one refresh");
    clock.advance(20_000);
    assert.equal(runs(), 2, "the interval restarts from the wake");
  });

  it("wake() is ignored while hidden", () => {
    const { clock, auto, runs } = setup();
    auto.setVisible(false);
    clock.advance(60_000);
    auto.wake();
    assert.equal(runs(), 0);
  });

  it("stops for good once disposed", () => {
    const { clock, auto, runs } = setup();
    auto.dispose();
    clock.advance(60_000);
    auto.wake();
    auto.setVisible(false);
    auto.setVisible(true);
    assert.equal(runs(), 0);
    assert.equal(clock.pendingCount(), 0);
  });
});

describe("server reachability probe", () => {
  it("is reachable when the health route answers ok", async () => {
    const calls: string[] = [];
    const ok = await isServerReachable({
      online: true,
      fetch: async (url) => {
        calls.push(url);
        return { ok: true };
      },
    });
    assert.equal(ok, true);
    assert.deepEqual(calls, [AUTO_REFRESH_PROBE_URL]);
  });

  it("does not even ask while the browser is offline", async () => {
    let asked = false;
    const ok = await isServerReachable({
      online: false,
      fetch: async () => {
        asked = true;
        return { ok: true };
      },
    });
    assert.equal(ok, false);
    assert.equal(asked, false);
  });

  it("is unreachable on an error status (proxy up, app down)", async () => {
    assert.equal(await isServerReachable({ online: true, fetch: async () => ({ ok: false }) }), false);
  });

  it("is unreachable when the request fails", async () => {
    const ok = await isServerReachable({
      online: true,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    assert.equal(ok, false);
  });

  it("gives up on a server that never answers", async () => {
    const ok = await isServerReachable({
      online: true,
      timeoutMs: 10,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });
    assert.equal(ok, false);
  });
});
