/**
 * Lightweight auth shared by middleware (Edge) and route handlers (Node).
 * - UI: a signed session cookie issued after the shared password check.
 * - API writes: a static API key supplied via the `x-api-key` header.
 *
 * Uses Web Crypto (crypto.subtle) so it runs in both the Edge middleware
 * runtime and the Node server runtime.
 */

export const SESSION_COOKIE = "eyl_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
export const SESSION_MAX_AGE = MAX_AGE_SEC;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** Create a signed session token: `v1.<issuedAtMs>.<hmac>`. */
export async function createSessionToken(secret: string): Promise<string> {
  const payload = `v1.${Date.now()}`;
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

/** Verify a session token's signature and freshness. */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<boolean> {
  if (!token || !secret) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = await hmac(secret, payload);
  if (sig !== expected) return false;
  const parts = payload.split(".");
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt)) return false;
  if (Date.now() - issuedAt > MAX_AGE_SEC * 1000) return false;
  return true;
}

/** Constant-time-ish comparison of the request's API key against API_KEY. */
export function checkApiKey(req: Request): boolean {
  const provided = req.headers.get("x-api-key");
  const expected = process.env.API_KEY;
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Is this request allowed to perform a WRITE through the API?
 * Either it carries a valid API key, or it's a same-origin call from the
 * authenticated web UI (valid session cookie).
 */
export async function isWriteAuthorized(req: Request): Promise<boolean> {
  if (checkApiKey(req)) return true;
  const secret = process.env.SESSION_SECRET || "";
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : undefined;
  return verifySessionToken(token, secret);
}
