import { FunctionsHttpError } from "@supabase/supabase-js";
import { ensureCustomer, WhatsappError, type Db } from "@/lib/server/whatsappOrders";

/**
 * EYL wallet for the WhatsApp bot (/api/integrations/whatsapp/wallet/*). The rules live in the
 * database (EYL-APP migration 20261117120000_wallet.sql) and the razorpay-wallet edge function;
 * this only resolves the customer and passes calls through with the service role.
 * Money is paise everywhere.
 */

export type WalletEntry = { kind: "topup" | "debit" | "refund" | "adjustment"; amount_paise: number; note: string | null; created_at: string };
export type WalletLimits = { min_topup_paise: number; max_topup_paise: number; max_balance_paise: number };
export type Wallet = { balance_paise: number; limits: WalletLimits; entries: WalletEntry[] };

export type WalletTopup = {
  topup_id: string;
  amount_paise: number;
  payment_url: string;
  payment_link_id: string;
  expires_at: string | null;
};

export type WalletTopupStatus = {
  topup_id: string;
  status: "pending" | "paid" | "review" | "expired";
  amount_paise: number;
  balance_paise: number;
};

export type WalletMovement = { result: "recorded" | "already_recorded"; balance_paise: number };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

/** The customer's wallet: balance, limits and the latest movements. */
export async function getWallet(db: Db, waId: string): Promise<Wallet> {
  const customer = await ensureCustomer(db, waId);
  const { data, error } = await db.rpc("wallet_summary", { p_user: customer.user_id });
  if (error) throw new WhatsappError(500, `Couldn't load the wallet: ${error.message}`);
  return data as Wallet;
}

async function invokeWallet<T>(db: Db, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke("razorpay-wallet", { body });
  if (!error) return data as T;
  let status = 500;
  let payload: { error?: string; code?: string; room_paise?: number; limits?: WalletLimits } | null = null;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    status = error.context.status;
    try {
      payload = await error.context.json();
    } catch {
      payload = null;
    }
  }
  if (status === 404) throw new WhatsappError(404, payload?.error ?? "Not found");
  if (status === 409 && payload?.code === "over_limit") {
    const room = Number(payload.room_paise ?? 0);
    const cap = payload.limits ? rupees(payload.limits.max_balance_paise) : "its limit";
    throw new WhatsappError(
      422,
      room > 0
        ? `The wallet can hold up to ${cap}. You can add up to ${rupees(room)} right now.`
        : `The wallet can hold up to ${cap}, and it's full (counting top-ups still waiting for payment).`,
      "wallet_over_limit",
    );
  }
  if (status === 409 && payload?.code === "bad_amount") {
    const l = payload.limits;
    throw new WhatsappError(
      422,
      l ? `A top-up is between ${rupees(l.min_topup_paise)} and ${rupees(l.max_topup_paise)}, in whole rupees.` : "That top-up amount isn't allowed.",
      "wallet_bad_amount",
    );
  }
  console.error("[whatsapp] wallet call failed", body.action, status, payload?.code, error.message);
  throw new WhatsappError(500, payload?.code === "payments_unavailable" ? "Online payment is not available right now." : "The wallet couldn't be reached.");
}

/** Starts a top-up and returns its Razorpay payment link. Nothing is credited until it's paid. */
export async function createWalletTopup(db: Db, waId: string, amountPaise: number, name?: string | null): Promise<WalletTopup> {
  const customer = await ensureCustomer(db, waId, name);
  const out = await invokeWallet<Partial<WalletTopup>>(db, {
    action: "topup",
    user_id: customer.user_id,
    wa_id: waId,
    amount_paise: amountPaise,
  });
  if (typeof out?.topup_id !== "string" || typeof out.payment_url !== "string" || !out.payment_url) {
    throw new WhatsappError(500, "The top-up link couldn't be created.");
  }
  return {
    topup_id: out.topup_id,
    amount_paise: Number(out.amount_paise ?? amountPaise),
    payment_url: out.payment_url,
    payment_link_id: String(out.payment_link_id ?? ""),
    expires_at: out.expires_at ?? null,
  };
}

/** Where a top-up stands; a pending one is checked at Razorpay and credited if it was paid. */
export async function getWalletTopup(db: Db, topupId: string): Promise<WalletTopupStatus> {
  return invokeWallet<WalletTopupStatus>(db, { action: "status", topup_id: topupId });
}

async function linkedUserId(db: Db, waId: string): Promise<string> {
  const { data, error } = await db.from("whatsapp_customers").select("user_id").eq("wa_id", waId).maybeSingle();
  if (error) throw new WhatsappError(500, `Couldn't load the WhatsApp customer: ${error.message}`);
  const userId = (data as { user_id?: string } | null)?.user_id;
  if (!userId) throw new WhatsappError(404, "This WhatsApp number has no EYL wallet.");
  return userId;
}

/**
 * Takes money from the wallet for one purchase. `ref` identifies the purchase: the same ref
 * never debits twice. 409 `wallet_insufficient` when the balance is too low.
 */
export async function debitWallet(db: Db, waId: string, amountPaise: number, ref: string, note?: string | null): Promise<WalletMovement> {
  const userId = await linkedUserId(db, waId);
  const { data, error } = await db.rpc("wallet_debit", { p_user: userId, p_amount_paise: amountPaise, p_ref: ref, p_note: note ?? null });
  if (error) {
    if (error.code === "23505") throw new WhatsappError(409, "That purchase was already charged a different amount.", "wallet_ref_mismatch");
    throw new WhatsappError(500, `Couldn't debit the wallet: ${error.message}`);
  }
  const out = data as { result: string; balance_paise: number };
  if (out.result === "insufficient") {
    throw new WhatsappError(409, `The wallet has ${rupees(out.balance_paise)}, which isn't enough.`, "wallet_insufficient");
  }
  return { result: out.result as WalletMovement["result"], balance_paise: out.balance_paise };
}

/** Gives back all or part of a debit (a purchase that failed or was cancelled). Once per debit. */
export async function refundWallet(db: Db, waId: string, amountPaise: number, ref: string, note?: string | null): Promise<WalletMovement> {
  const userId = await linkedUserId(db, waId);
  const { data, error } = await db.rpc("wallet_refund", { p_user: userId, p_amount_paise: amountPaise, p_ref: ref, p_note: note ?? null });
  if (error) {
    if (error.code === "22023") throw new WhatsappError(422, "A refund can't be more than what was taken.", "wallet_refund_too_much");
    throw new WhatsappError(500, `Couldn't refund the wallet: ${error.message}`);
  }
  const out = data as { result: string; balance_paise: number };
  if (out.result === "no_debit") throw new WhatsappError(404, "There is no wallet charge with that reference.");
  return { result: out.result as WalletMovement["result"], balance_paise: out.balance_paise };
}
