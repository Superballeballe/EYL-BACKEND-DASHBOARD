import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return NextResponse.json({
    ok: true,
    service: "eyl-backend-dashboard",
    supabaseConfigured: configured,
    time: new Date().toISOString(),
  });
}
