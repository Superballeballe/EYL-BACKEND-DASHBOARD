/**
 * One-shot wipe of all EYL app data via Supabase REST (service role).
 * Usage: npx tsx scripts/reset-all-data.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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
      /* try next file */
    }
  }
}

async function wipeById(db: ReturnType<typeof createClient>, table: string) {
  const probe = await db.from(table).select("id", { count: "exact", head: true });
  if (probe.error?.code === "42P01" || probe.error?.message?.includes("schema cache")) {
    console.log(`  ${table}: skipped (table missing)`);
    return;
  }
  const { error, count } = await db
    .from(table)
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: deleted ${count ?? 0} rows`);
}

async function wipeWorkDays(db: ReturnType<typeof createClient>) {
  const { error, count } = await db
    .from("work_days")
    .delete({ count: "exact" })
    .neq("work_date", "1900-01-01");
  if (error) throw new Error(`work_days: ${error.message}`);
  console.log(`  work_days: deleted ${count ?? 0} rows`);
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("Wiping EYL data…");

  for (const table of [
    "dashboard_email_verifications",
    "dashboard_invites",
    "dashboard_users",
    "daily_assignments",
    "knight_salaries",
    "deliveries",
  ]) {
    await wipeById(db, table);
  }

  await wipeWorkDays(db);

  for (const table of ["knights", "clients", "rate_tiers", "app_push_tokens", "orders"]) {
    await wipeById(db, table);
  }

  console.log("Wiping auth.users…");
  let page = 1;
  let totalAuth = 0;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data.users ?? [];
    if (!users.length) break;
    for (const u of users) {
      const { error: delErr } = await db.auth.admin.deleteUser(u.id);
      if (delErr) throw delErr;
      totalAuth++;
    }
    if (users.length < 200) break;
    page++;
  }
  console.log(`  auth.users: deleted ${totalAuth} rows`);

  const { count } = await db.from("dashboard_users").select("*", { count: "exact", head: true });
  console.log(`\nDone. dashboard_users remaining: ${count ?? "?"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
