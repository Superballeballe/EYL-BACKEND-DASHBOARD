/** Seed knight-visible app orders: npx tsx scripts/create-test-knight-orders.ts [count] */
import { readFileSync } from "fs";
import { resolve } from "path";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

const ROUTES = [
  {
    pickup: "Bandra West, Mumbai, Maharashtra",
    drop: "Powai, Mumbai, Maharashtra",
    recipient: "Test Recipient A",
    phone: "9876543210",
    amount: 250,
  },
  {
    pickup: "Andheri East, Mumbai, Maharashtra",
    drop: "Colaba, Mumbai, Maharashtra",
    recipient: "Test Recipient B",
    phone: "9876543211",
    amount: 320,
  },
  {
    pickup: "Lower Parel, Mumbai, Maharashtra",
    drop: "Malad West, Mumbai, Maharashtra",
    recipient: "Test Recipient C",
    phone: "9876543212",
    amount: 180,
  },
  {
    pickup: "Ghatkopar, Mumbai, Maharashtra",
    drop: "Worli, Mumbai, Maharashtra",
    recipient: "Test Recipient D",
    phone: "9876543213",
    amount: 290,
  },
];

function orderCode() {
  return `APPEYL${Math.floor(100000 + Math.random() * 900000)}`;
}

async function main() {
  const count = Math.min(Math.max(Number(process.argv[2] ?? 4), 1), 10);
  const db = supabaseAdmin();

  const { data: seedUser, error: userError } = await db
    .from("orders")
    .select("user_id")
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (userError || !seedUser?.user_id) {
    console.error("Need at least one existing order user_id to attach test orders.");
    process.exit(1);
  }

  const created: { order_code: string; id: string }[] = [];

  for (let i = 0; i < count; i++) {
    const route = ROUTES[i % ROUTES.length];
    const code = orderCode();
    const now = new Date().toISOString();
    const scheduled = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        user_id: seedUser.user_id,
        order_code: code,
        status: "placed",
        pickup_address: route.pickup,
        delivery_address: route.drop,
        recipient_name: route.recipient,
        recipient_phone: route.phone,
        total_price: route.amount,
        placed_at: now,
        scheduled_for: scheduled,
        pickup_scheduled_at: scheduled,
        delivery_scheduled_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        pickup: { contact_name: "Test Sender", contact_phone: "9123456789", line: route.pickup },
        delivery: { contact_name: route.recipient, contact_phone: route.phone, line: route.drop },
        item_type: { label: "Documents", sender_name: "Test Sender" },
        payment_method: { method: "upi", status: "pending" },
      })
      .select("id, order_code")
      .single();

    if (orderError || !order) {
      console.error(`Order ${i + 1} failed:`, orderError?.message);
      continue;
    }

    const { error: invoiceError } = await db.from("invoices").insert({
      order_id: order.id,
      invoice_number: `INV-${code}`,
      invoice_type: "receipt",
      payment_method: "upi",
      payment_status: "pending",
      subtotal: route.amount,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: route.amount,
      currency: "INR",
      metadata: { test_seed: true, note: "Knight app visibility test" },
      issued_at: now,
      is_gst: false,
      is_interstate: false,
      taxable_value: route.amount,
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      igst_rate: 0,
      igst_amount: 0,
    });

    if (invoiceError) {
      console.error(`Invoice for ${code} failed:`, invoiceError.message);
      await db.from("orders").delete().eq("id", order.id);
      continue;
    }

    created.push({ order_code: order.order_code, id: order.id });
  }

  console.log(`Created ${created.length} knight-visible test order(s):\n`);
  for (const row of created) {
    console.log(`  ${row.order_code}  (${row.id})`);
  }
  console.log("\nThese should appear in EYL Knight → Available (invoice pending, no knight assigned).");
  console.log("Dashboard → New jobs should also list the linked deliveries.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
