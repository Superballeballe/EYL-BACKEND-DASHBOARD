import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retired. The dashboard never sends refunds on its own any more: the
 * database refund worker (pg_cron + razorpay-refund-worker) owns automatic
 * refunds, and ops refund by hand through ops-refund (Refunds page).
 *
 * Kept as a 410 so the old VPS cron (/etc/cron.d/eyl-refunds) fails loudly
 * and harmlessly until it is removed. Takes no auth, reads nothing, writes
 * nothing.
 */
const GONE = {
  processed: 0,
  note: "Retired: the dashboard no longer processes refunds. Remove the eyl-refunds cron on the server.",
};

export function POST() {
  return NextResponse.json(GONE, { status: 410 });
}

export function GET() {
  return NextResponse.json(GONE, { status: 410 });
}
