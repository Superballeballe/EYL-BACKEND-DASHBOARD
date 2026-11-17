import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { whatsappWalletMovementSchema, whatsappWalletTopupSchema } from "./schemas/whatsapp";
import { WhatsappError, type Db } from "./server/whatsappOrders";
import { createWalletTopup, debitWallet, getWallet, getWalletTopup, refundWallet } from "./server/whatsappWallet";

const WA = "919812345678";
const USER = "0a0b0c0d-1111-4222-8333-444455556666";
const TOPUP = "3f0c2a1e-1111-4222-8333-444455556666";

type Result = { data?: unknown; error?: unknown };

/** A Db whose customer lookup finds USER (or nobody), with scripted rpc and edge-function answers. */
function fakeDb(h: { linked?: boolean; rpc?: (name: string, args: Record<string, unknown>) => Result; invoke?: (body: Record<string, unknown>) => Result }) {
  const calls = { rpc: [] as [string, Record<string, unknown>][], invoke: [] as Record<string, unknown>[] };
  const row = h.linked === false ? null : { wa_id: WA, user_id: USER, phone10: "9812345678", name: "Ravi" };
  const b: Record<string, unknown> = {
    select: () => b,
    eq: () => b,
    upsert: () => b,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok),
  };
  const db = {
    from: () => b,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.rpc.push([name, args]);
      const r = h.rpc?.(name, args) ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    },
    functions: {
      invoke: async (_name: string, opts: { body: Record<string, unknown> }) => {
        calls.invoke.push(opts.body);
        const r = h.invoke?.(opts.body) ?? {};
        return { data: r.data ?? null, error: r.error ?? null };
      },
    },
    auth: { admin: {} },
  } as unknown as Db;
  return { db, calls };
}

const fnError = (status: number, body: unknown) => new FunctionsHttpError(new Response(JSON.stringify(body), { status }));
const LIMITS = { min_topup_paise: 10000, max_topup_paise: 500000, max_balance_paise: 1000000 };

async function refusal(p: Promise<unknown>): Promise<WhatsappError> {
  try {
    await p;
  } catch (e) {
    assert.ok(e instanceof WhatsappError, `expected a WhatsappError, got ${e}`);
    return e;
  }
  assert.fail("expected a refusal");
}

describe("whatsapp wallet", () => {
  it("reads the wallet of the linked customer", async () => {
    const wallet = { balance_paise: 100000, limits: LIMITS, entries: [] };
    const { db, calls } = fakeDb({ rpc: () => ({ data: wallet }) });
    assert.deepEqual(await getWallet(db, WA), wallet);
    assert.deepEqual(calls.rpc, [["wallet_summary", { p_user: USER }]]);
  });

  it("starts a top-up in paise for that customer and returns the link", async () => {
    const { db, calls } = fakeDb({
      invoke: () => ({ data: { topup_id: TOPUP, amount_paise: 100000, payment_url: "https://rzp.io/i/x", payment_link_id: "plink_1", expires_at: null } }),
    });
    const out = await createWalletTopup(db, WA, 100000);
    assert.equal(out.payment_url, "https://rzp.io/i/x");
    assert.deepEqual(calls.invoke, [{ action: "topup", user_id: USER, wa_id: WA, amount_paise: 100000 }]);
  });

  it("explains the limits in rupees", async () => {
    const over = fakeDb({ invoke: () => ({ error: fnError(409, { code: "over_limit", room_paise: 100000, limits: LIMITS }) }) });
    const e1 = await refusal(createWalletTopup(over.db, WA, 200000));
    assert.equal(e1.status, 422);
    assert.equal(e1.code, "wallet_over_limit");
    assert.match(e1.message, /up to ₹10,000.*add up to ₹1,000/);
    const bad = fakeDb({ invoke: () => ({ error: fnError(409, { code: "bad_amount", limits: LIMITS }) }) });
    const e2 = await refusal(createWalletTopup(bad.db, WA, 5000));
    assert.equal(e2.code, "wallet_bad_amount");
    assert.match(e2.message, /between ₹100 and ₹5,000/);
    const down = fakeDb({ invoke: () => ({ error: fnError(503, { code: "payments_unavailable" }) }) });
    assert.equal((await refusal(createWalletTopup(down.db, WA, 100000))).status, 500);
  });

  it("a link without a URL is an error, never a silent success", async () => {
    const { db } = fakeDb({ invoke: () => ({ data: { topup_id: TOPUP } }) });
    assert.equal((await refusal(createWalletTopup(db, WA, 100000))).status, 500);
  });

  it("passes a status check through", async () => {
    const { db, calls } = fakeDb({ invoke: () => ({ data: { topup_id: TOPUP, status: "paid", amount_paise: 100000, balance_paise: 100000 } }) });
    assert.equal((await getWalletTopup(db, TOPUP)).status, "paid");
    assert.deepEqual(calls.invoke, [{ action: "status", topup_id: TOPUP }]);
  });

  it("debits, and refuses an overdraft or an unknown customer without creating one", async () => {
    const okDb = fakeDb({ rpc: () => ({ data: { result: "recorded", balance_paise: 10200 } }) });
    assert.deepEqual(await debitWallet(okDb.db, WA, 89800, "task:1", "BookMyShow"), { result: "recorded", balance_paise: 10200 });
    assert.deepEqual(okDb.calls.rpc, [["wallet_debit", { p_user: USER, p_amount_paise: 89800, p_ref: "task:1", p_note: "BookMyShow" }]]);

    const low = fakeDb({ rpc: () => ({ data: { result: "insufficient", balance_paise: 5000 } }) });
    const e = await refusal(debitWallet(low.db, WA, 89800, "task:1"));
    assert.equal(e.status, 409);
    assert.equal(e.code, "wallet_insufficient");
    assert.match(e.message, /₹50/);

    const nobody = fakeDb({ linked: false });
    assert.equal((await refusal(debitWallet(nobody.db, WA, 100, "task:2"))).status, 404);
    assert.deepEqual(nobody.calls.rpc, []);

    const clash = fakeDb({ rpc: () => ({ error: { code: "23505", message: "different amount" } }) });
    assert.equal((await refusal(debitWallet(clash.db, WA, 100, "task:1"))).code, "wallet_ref_mismatch");
  });

  it("refunds a charge, and says when there is none or it is too much", async () => {
    const okDb = fakeDb({ rpc: () => ({ data: { result: "recorded", balance_paise: 100000 } }) });
    assert.equal((await refundWallet(okDb.db, WA, 89800, "task:1")).result, "recorded");
    const none = fakeDb({ rpc: () => ({ data: { result: "no_debit", balance_paise: 0 } }) });
    assert.equal((await refusal(refundWallet(none.db, WA, 100, "task:9"))).status, 404);
    const much = fakeDb({ rpc: () => ({ error: { code: "22023", message: "more than" } }) });
    assert.equal((await refusal(refundWallet(much.db, WA, 999999, "task:1"))).code, "wallet_refund_too_much");
  });

  it("schemas: whole rupees for a top-up, positive paise and a ref for a charge", () => {
    assert.equal(whatsappWalletTopupSchema.safeParse({ wa_id: "+919812345678", amount_rupees: 1000 }).success, true);
    assert.equal(whatsappWalletTopupSchema.safeParse({ wa_id: WA, amount_rupees: 99.5 }).success, false);
    assert.equal(whatsappWalletTopupSchema.safeParse({ wa_id: WA, amount_rupees: -1 }).success, false);
    assert.equal(whatsappWalletMovementSchema.safeParse({ wa_id: WA, amount_paise: 89800, ref: "task:1" }).success, true);
    assert.equal(whatsappWalletMovementSchema.safeParse({ wa_id: WA, amount_paise: 0, ref: "task:1" }).success, false);
    assert.equal(whatsappWalletMovementSchema.safeParse({ wa_id: WA, amount_paise: 100, ref: " " }).success, false);
  });
});
