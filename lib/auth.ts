/**
 * Session auth shared by middleware (Edge) and route handlers (Node).
 * Tokens: v2.<userId>.<issuedAtMs>.<hmac>
 */

export const SESSION_COOKIE = "eyl_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days
export const SESSION_MAX_AGE = MAX_AGE_SEC;

export type SessionPayload = {
  userId: string;
  issuedAt: number;
};

const encoder = new TextEncoder();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function createSessionToken(secret: string, userId: string): Promise<string> {
  const payload = `v2.${userId}.${Date.now()}`;
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function parseSessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = await hmac(secret, payload);
  if (sig !== expected) return null;

  const parts = payload.split(".");
  if (parts[0] !== "v2" || parts.length !== 3) return null;

  const userId = parts[1];
  const issuedAt = Number(parts[2]);
  if (!UUID_RE.test(userId) || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > MAX_AGE_SEC * 1000) return null;

  return { userId, issuedAt };
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<boolean> {
  return (await parseSessionToken(token, secret)) !== null;
}

export function readSessionCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function cookieSecure(req: Request): boolean {
  return (
    new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https"
  );
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

export async function isWriteAuthorized(req: Request): Promise<boolean> {
  if (checkApiKey(req)) return true;
  const secret = process.env.SESSION_SECRET || "";
  const token = readSessionCookie(req.headers.get("cookie"));
  return verifySessionToken(token, secret);
}
