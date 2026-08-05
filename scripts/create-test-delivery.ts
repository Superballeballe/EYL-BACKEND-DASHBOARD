/** One-shot: npx tsx scripts/create-test-delivery.ts */
import { readFileSync } from "fs";
import { resolve } from "path";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextSerial } from "@/lib/server/serial";
import { nextInvoiceNo } from "@/lib/server/invoice";
import { resolveKnight } from "@/lib/server/roster";
import { formatSerialCode } from "@/lib/serial";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
      return;
    } catch {
      /* try next */
    }
  }
}

loadEnv();

function localTodayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const today = localTodayISO();

async function main() {
  const db = supabaseAdmin();

  const { data: knight } = await db
    .from("knights")
    .select("id, display_name")
    .eq("active", true)
    .order("display_name")
    .limit(1)
    .maybeSingle();

  const serial = await nextSerial(db, "b2b");
  const invoice = await nextInvoiceNo(db);

  const row = await resolveKnight({
    task_date: today,
    booking_date: today,
    mode_of_booking: "b2b" as const,
    serial_no: serial.serial_no,
    sender_name: "Test Sender Co.",
    pickup_location: "Connaught Place, New Delhi, Delhi 110001, India",
    pickup_time_window: `${today}T10:00`,
    pickup_actual_time: `${today}T10:15`,
    drop_location: "India Gate, New Delhi, Delhi 110003, India",
    drop_recipient_name: "Test Recipient",
    recipient_phone: "9876543210",
    drop_time_window: `${today}T11:00`,
    drop_actual_time: `${today}T11:20`,
    knight_id: knight?.id ?? null,
    knight_name: knight?.display_name ?? "Test Knight",
    assignment_status: "assigned" as const,
    fulfillment_status: "booked" as const,
    working_hours: "1:05",
    fees: 350,
    kms: 4.2,
    payment_status: "unpaid" as const,
    payment_mode: "cash",
    final_bill_amount: 350,
    billing_name: "Test Billing Client",
    invoice_no: invoice.invoice_no,
    content: "Test parcel — documents",
    remark: "Auto-created test delivery",
    needs_review: false,
  });

  const { data, error } = await db.from("deliveries").insert(row).select().single();
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  const code = formatSerialCode(data.mode_of_booking, data.serial_no, data.app_order_id);
  console.log("Created test delivery:");
  console.log(`  ID:      ${data.id}`);
  console.log(`  Serial:  ${code}`);
  console.log(`  Invoice: ${data.invoice_no}`);
  console.log(`  Knight:  ${data.knight_name}`);
  console.log(`  Date:    ${data.task_date}`);
  console.log(`  Route:   ${data.pickup_location} → ${data.drop_location}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
