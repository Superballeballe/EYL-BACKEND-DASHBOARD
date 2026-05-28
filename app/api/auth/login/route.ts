import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET || "";
  if (!expected || !secret) {
    return NextResponse.json(
      { error: "Server auth is not configured (APP_PASSWORD / SESSION_SECRET)." },
      { status: 500 },
    );
  }
  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Mark Secure only when actually served over HTTPS, so self-hosting over
  // plain http://<lan-ip> still works (a Secure cookie wouldn't be stored there).
  const isHttps =
    new URL(req.url).protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";

  const token = await createSessionToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
