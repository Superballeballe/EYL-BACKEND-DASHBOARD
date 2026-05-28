import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Paths that never require a session.
const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET || "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionOk = await verifySessionToken(token, secret);

  // API routes: allow a valid session (the authed UI) OR a valid API key.
  if (pathname.startsWith("/api")) {
    if (sessionOk) return NextResponse.next();
    const apiKey = req.headers.get("x-api-key");
    if (apiKey && process.env.API_KEY && apiKey === process.env.API_KEY) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // UI routes: must have a valid session, otherwise go to /login.
  if (!sessionOk) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
