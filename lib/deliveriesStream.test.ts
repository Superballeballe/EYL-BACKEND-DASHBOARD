import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { subscribeDeliveriesStream } from "./server/deliveriesStream";

// An unreachable host: these tests exercise realtime-js channel bookkeeping,
// which is what decides whether a second stream can subscribe at all.
const clients: SupabaseClient[] = [];
function client() {
  const db = createClient("http://127.0.0.1:9", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(db);
  return db;
}

const quiet = { change() {}, order() {}, settled() {}, down() {} };

afterEach(async () => {
  for (const db of clients.splice(0)) {
    await db.removeAllChannels();
    db.realtime.disconnect();
  }
});

describe("subscribeDeliveriesStream", () => {
  it("lets every stream of one operator subscribe (two per tab, more tabs, other devices)", () => {
    const db = client();
    const first = subscribeDeliveriesStream(db, "user-1", quiet);
    // The dashboard's shared admin client sees the next stream while the first
    // is still joining; a per-user topic made this throw.
    const second = subscribeDeliveriesStream(db, "user-1", quiet);
    const third = subscribeDeliveriesStream(db, "user-1", quiet);
    assert.equal(new Set([first.topic, second.topic, third.topic]).size, 3);
    assert.equal(db.getChannels().length, 3);
  });

  it("closing one stream leaves the others subscribed", async () => {
    const db = client();
    const first = subscribeDeliveriesStream(db, "user-1", quiet);
    const second = subscribeDeliveriesStream(db, "user-1", quiet);
    await db.removeChannel(first);
    assert.deepEqual(db.getChannels().map((c) => c.topic), [second.topic]);
  });

  it("reports a closed subscription so the route can end the response", async () => {
    const db = client();
    const statuses: string[] = [];
    const channel = subscribeDeliveriesStream(db, "user-1", { ...quiet, down: (status) => statuses.push(status) });
    await db.removeChannel(channel);
    assert.deepEqual(statuses, ["CLOSED"]);
  });
});
