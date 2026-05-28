/**
 * Import the EYL Excel workbook into Supabase.
 *
 *   npm run import -- --file="/path/to/Line Up ... .xlsx" --month=2026-05
 *   npm run import -- --file="..." --dry-run        # parse + report, no writes
 *   npm run import -- --file="..."                  # all daily sheets
 *
 * Reads env from .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Idempotent: deliveries upsert on (src_sheet, src_row); knights/clients/rates
 * are inserted only when missing; lineups are replaced per day.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  cleanText,
  toNumber,
  normHeader,
  normalizeMode,
  normalizePaymentStatus,
  normalizePaymentMode,
  parseDateValue,
  parseTimeCell,
  parseSheetDate,
  mapDeliveryHeaders,
  isDeliveryHeaderRow,
  buildRoster,
  matchKnight,
  type CellValue,
} from "../lib/parse/index";

// --------------------------------------------------------------------------
// env + args
// --------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split("=").slice(1).join("=") : undefined;
  };
  return {
    file: get("file"),
    month: get("month"), // YYYY-MM
    dryRun: args.includes("--dry-run"),
  };
}

const titleFirst = (full: string) => {
  const tok = full.trim().split(/\s+/)[0] ?? full;
  return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
};

// A real knight name in Sheet3 is multi-word ALL CAPS with no digits, e.g.
// "VILAS KISAN BODKE". This rejects the salary-template rows that share the
// column ("Gross Salary", "PF 12%", "18000.0", "EARNINGS", "HRA", …).
const isPersonName = (name: string) =>
  /^[A-Z][A-Z.\s]+$/.test(name) && name.trim().includes(" ") && !/\d/.test(name);

const cell = (row: CellValue[] | undefined, idx: number | undefined): CellValue =>
  idx === undefined || !row ? null : (row[idx] ?? null);

type Row = CellValue[];
function sheetRows(ws: XLSX.WorkSheet): Row[] {
  // Keep blank rows so absolute row indexing stays correct.
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

let db: SupabaseClient;

async function chunkedUpsert(table: string, rows: any[], onConflict?: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error } = await db.from(table).upsert(slice, onConflict ? { onConflict } : undefined);
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

// --------------------------------------------------------------------------
// Sheet3 -> knights + knight_salaries
// --------------------------------------------------------------------------
async function importKnights(wb: XLSX.WorkBook, dryRun: boolean) {
  const ws = wb.Sheets["Sheet3"];
  if (!ws) return { rosterMap: new Map<string, string>(), knightCount: 0, salaryCount: 0 };
  const rows = sheetRows(ws);

  // Blocks start at column index 2 (C) and repeat every 5 columns.
  const blockCols: number[] = [];
  const headerRow = rows[2] ?? [];
  headerRow.forEach((v, i) => {
    if (normHeader(v) === "knights name") blockCols.push(i);
  });

  // Collect distinct knights (full name), plus role/joining from the first block.
  const byName = new Map<string, { full_name: string; role: string | null; joining_date: string | null }>();
  for (const c of blockCols) {
    for (let r = 3; r < rows.length; r++) {
      const name = cleanText(cell(rows[r], c));
      if (!name || !isPersonName(name)) continue;
      if (!byName.has(name)) {
        const isFirst = c === blockCols[0];
        const role = isFirst ? cleanText(cell(rows[r], 0))?.toLowerCase() ?? null : null;
        const joining = isFirst ? parseDateValue(cell(rows[r], 1)) : null;
        byName.set(name, {
          full_name: name,
          role: role === "walker" || role === "biker" ? role : null,
          joining_date: joining,
        });
      }
    }
  }

  const knightRows = [...byName.values()].map((k) => ({
    full_name: k.full_name,
    display_name: titleFirst(k.full_name),
    role: k.role,
    joining_date: k.joining_date,
  }));

  // Insert knights that don't already exist (by display_name, case-insensitive).
  let have = new Set<string>();
  if (!dryRun) {
    const { data: existing } = await db.from("knights").select("id, display_name");
    have = new Set((existing ?? []).map((k: any) => k.display_name.toLowerCase()));
  }
  const toInsert = knightRows.filter((k) => !have.has(k.display_name.toLowerCase()));
  if (!dryRun && toInsert.length) {
    const { error } = await db.from("knights").insert(toInsert);
    if (error) throw new Error(`knights insert failed: ${error.message}`);
  }

  // Roster (real ids in live mode; synthetic ids for dry-run resolution).
  let rosterMap: Map<string, string>;
  if (!dryRun) {
    const { data: all } = await db.from("knights").select("id, display_name");
    rosterMap = buildRoster(all ?? []);
  } else {
    rosterMap = buildRoster(knightRows.map((k, i) => ({ id: `dry-${i}`, display_name: k.display_name })));
  }

  // Salaries per block (month from row index 1 of the block's name column).
  const salRows: any[] = [];
  for (const c of blockCols) {
    const month = parseDateValue(cell(rows[1], c));
    if (!month) continue;
    for (let r = 3; r < rows.length; r++) {
      const name = cleanText(cell(rows[r], c));
      if (!name || !isPersonName(name)) continue;
      const kid = matchKnight(titleFirst(name), rosterMap).knight_id;
      if (!kid) continue;
      const travel = toNumber(cell(rows[r], c + 1)) ?? 0;
      const salary = toNumber(cell(rows[r], c + 2)) ?? 0;
      const total = toNumber(cell(rows[r], c + 3)) ?? travel + salary;
      salRows.push({ knight_id: kid, month, travel, salary, total });
    }
  }
  // De-dupe on (knight_id, month) keeping the last occurrence.
  const dedup = new Map<string, any>();
  for (const s of salRows) dedup.set(`${s.knight_id}|${s.month}`, s);
  const finalRows = [...dedup.values()];
  if (!dryRun) await chunkedUpsert("knight_salaries", finalRows, "knight_id,month");

  return { rosterMap, knightCount: knightRows.length, salaryCount: finalRows.length };
}

// --------------------------------------------------------------------------
// "Billind Details" -> clients
// --------------------------------------------------------------------------
async function importClients(wb: XLSX.WorkBook, dryRun: boolean) {
  const name = wb.SheetNames.find((s) => normHeader(s).startsWith("billind"));
  if (!name) return { count: 0, map: new Map<string, string>() };
  const rows = sheetRows(wb.Sheets[name]);

  const clientRows: any[] = [];
  for (let r = 1; r < rows.length; r++) {
    const clientName = cleanText(cell(rows[r], 0));
    if (!clientName) continue;
    const gst = cleanText(cell(rows[r], 3));
    clientRows.push({
      client_name: clientName,
      company_name: cleanText(cell(rows[r], 1)),
      address: cleanText(cell(rows[r], 2)),
      gst_no: gst && gst.toUpperCase() !== "NA" ? gst : null,
    });
  }

  let have = new Set<string>();
  if (!dryRun) {
    const { data: existing } = await db.from("clients").select("id, client_name");
    have = new Set((existing ?? []).map((c: any) => c.client_name.toLowerCase()));
  }
  // De-dupe within the sheet too.
  const seen = new Set<string>();
  const toInsert = clientRows.filter((c) => {
    const key = c.client_name.toLowerCase();
    if (have.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!dryRun && toInsert.length) {
    const { error } = await db.from("clients").insert(toInsert);
    if (error) throw new Error(`clients insert failed: ${error.message}`);
  }

  let map = new Map<string, string>();
  if (!dryRun) {
    const { data: all } = await db.from("clients").select("id, client_name");
    map = new Map<string, string>((all ?? []).map((c: any) => [c.client_name.toLowerCase(), c.id]));
  }
  return { count: clientRows.length, map };
}

// --------------------------------------------------------------------------
// rate cards -> rate_tiers
// --------------------------------------------------------------------------
function parseKmRange(label: string | null): { min: number | null; max: number | null } {
  if (!label) return { min: null, max: null };
  const nums = (label.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (/above|beyond/i.test(label)) return { min: nums[0] ?? null, max: null };
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: null, max: null };
}

async function importRates(wb: XLSX.WorkBook, dryRun: boolean) {
  // Wipe + reload so re-runs stay clean.
  if (!dryRun) await db.from("rate_tiers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const tiers: any[] = [];

  const eyl = wb.Sheets["EYL Rates revision"];
  if (eyl) {
    const rows = sheetRows(eyl);
    for (let r = 2; r <= 12; r++) {
      const oldLabel = cleanText(cell(rows[r], 0));
      const newLabel = cleanText(cell(rows[r], 5));
      if (newLabel) {
        const { min, max } = parseKmRange(newLabel);
        tiers.push({ provider: "eyl", label: newLabel, min_km: min, max_km: max, is_current: true, fee_ex_gst: toNumber(cell(rows[r], 6)), gst_amount: toNumber(cell(rows[r], 7)), fee: toNumber(cell(rows[r], 8)) });
        tiers.push({ provider: "eyl_cake", label: newLabel, min_km: min, max_km: max, is_current: true, fee_ex_gst: toNumber(cell(rows[r], 9)), gst_amount: toNumber(cell(rows[r], 10)), fee: toNumber(cell(rows[r], 11)) });
      }
      if (oldLabel) {
        const { min, max } = parseKmRange(oldLabel);
        tiers.push({ provider: "eyl", label: oldLabel, min_km: min, max_km: max, is_current: false, fee_ex_gst: toNumber(cell(rows[r], 1)), gst_amount: toNumber(cell(rows[r], 2)), fee: toNumber(cell(rows[r], 3)) });
      }
    }
  }

  const fud = wb.Sheets["Fudpro Rate revision"];
  if (fud) {
    const rows = sheetRows(fud);
    for (let r = 14; r <= 21; r++) {
      const label = cleanText(cell(rows[r], 3));
      const fee = toNumber(cell(rows[r], 4));
      if (label && fee != null) {
        const { min, max } = parseKmRange(label);
        tiers.push({ provider: "fudpro", label, min_km: min, max_km: max, fee, is_current: true });
      }
      const oldLabel = cleanText(cell(rows[r], 0));
      const oldFee = toNumber(cell(rows[r], 1));
      if (oldLabel && oldFee != null) {
        const { min, max } = parseKmRange(oldLabel);
        tiers.push({ provider: "fudpro", label: oldLabel, min_km: min, max_km: max, fee: oldFee, is_current: false });
      }
    }
  }

  if (!dryRun && tiers.length) await chunkedUpsert("rate_tiers", tiers);
  return { count: tiers.length };
}

// --------------------------------------------------------------------------
// daily sheets -> work_days + daily_assignments + deliveries
// --------------------------------------------------------------------------
function findLineup(rows: Row[], stopRow: number) {
  let walkerCol = -1;
  let bikerCol = -1;
  let headerRow = -1;
  for (let r = 0; r < Math.min(stopRow, rows.length); r++) {
    (rows[r] ?? []).forEach((v, c) => {
      const h = normHeader(v);
      if (h === "walker name") {
        walkerCol = c;
        headerRow = r;
      }
      if (h === "biker name") bikerCol = c;
    });
    if (walkerCol >= 0) break;
  }
  return { walkerCol, bikerCol, headerRow };
}

const windowVal = (v: CellValue) => (v instanceof Date ? parseTimeCell(v).value : cleanText(v));

async function importDay(
  wb: XLSX.WorkBook,
  sheetName: string,
  roster: Map<string, string>,
  clients: Map<string, string>,
  dryRun: boolean,
) {
  const sd = parseSheetDate(sheetName);
  if (!sd) return null;
  const rows = sheetRows(wb.Sheets[sheetName]);

  // delivery header row
  let headerIdx = -1;
  for (let r = 0; r < rows.length; r++) {
    if (isDeliveryHeaderRow(rows[r] ?? [])) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx < 0) return null;
  const map = mapDeliveryHeaders(rows[headerIdx] ?? []);

  // ---- lineup ----
  const { walkerCol, bikerCol, headerRow } = findLineup(rows, headerIdx);
  const assignments: any[] = [];
  const noteParts: string[] = [];
  if (walkerCol >= 0) {
    for (let r = 0; r < headerIdx; r++) {
      const rowArr = rows[r] ?? [];
      for (const c of rowArr) {
        const t = cleanText(c);
        if (t && /(on leave|half day|on half)/i.test(t)) noteParts.push(t);
      }
      if (r <= headerRow) continue;
      const wName = cleanText(cell(rowArr, walkerCol));
      if (wName && !/walker|biker/i.test(wName)) {
        const m = matchKnight(wName, roster);
        assignments.push({
          work_date: sd.date,
          knight_id: m.knight_id,
          knight_name: wName,
          role: "walker",
          location: cleanText(cell(rowArr, walkerCol + 1)),
          shift_time: cleanText(cell(rowArr, walkerCol + 2)),
          status: "working",
          position: assignments.length,
        });
      }
      if (bikerCol >= 0) {
        const bName = cleanText(cell(rowArr, bikerCol));
        if (bName && !/walker|biker/i.test(bName)) {
          const m = matchKnight(bName, roster);
          assignments.push({
            work_date: sd.date,
            knight_id: m.knight_id,
            knight_name: bName,
            role: "biker",
            location: cleanText(cell(rowArr, bikerCol + 1)),
            shift_time: cleanText(cell(rowArr, bikerCol + 2)),
            status: "working",
            position: assignments.length,
          });
        }
      }
    }
  }
  const walker_count = assignments.filter((a) => a.role === "walker").length;
  const biker_count = assignments.filter((a) => a.role === "biker").length;

  // ---- deliveries ----
  const deliveries: any[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const rowArr = rows[r] ?? [];
    const senderName = cleanText(cell(rowArr, map.sender_name));
    const pickup = cleanText(cell(rowArr, map.pickup_location));
    const knightRaw = cell(rowArr, map.knight_name);
    const serial = toNumber(cell(rowArr, map.serial_no));
    const drop = cleanText(cell(rowArr, map.drop_location));
    if (!senderName && !pickup && !drop && !cleanText(knightRaw) && serial == null) continue;

    let needsReview = false;
    const pAct = parseTimeCell(cell(rowArr, map.pickup_actual_time));
    const dAct = parseTimeCell(cell(rowArr, map.drop_actual_time));
    if (pAct.recovered || dAct.recovered) needsReview = true;

    const km = matchKnight(knightRaw, roster);
    const billingName = cleanText(cell(rowArr, map.billing_name));
    const clientId =
      (billingName && clients.get(billingName.toLowerCase())) ||
      (senderName && clients.get(senderName.toLowerCase())) ||
      null;

    deliveries.push({
      serial_no: serial,
      booking_date: parseDateValue(cell(rowArr, map.booking_date)),
      task_date: sd.date,
      mode_of_booking: normalizeMode(cell(rowArr, map.mode_of_booking)),
      sender_name: senderName,
      sender_last_name: cleanText(cell(rowArr, map.sender_last_name)),
      pickup_location: pickup,
      pickup_time_window: windowVal(cell(rowArr, map.pickup_time_window)),
      pickup_actual_time: pAct.value,
      drop_location: drop,
      drop_recipient_name: cleanText(cell(rowArr, map.drop_recipient_name)),
      drop_time_window: windowVal(cell(rowArr, map.drop_time_window)),
      drop_actual_time: dAct.value,
      knight_id: km.knight_id,
      knight_name: km.knight_name,
      assignment_status: km.assignment_status,
      fees: toNumber(cell(rowArr, map.fees)),
      kms: toNumber(cell(rowArr, map.kms)),
      working_hours: windowVal(cell(rowArr, map.working_hours)),
      cod_remark: cleanText(cell(rowArr, map.cod_remark)),
      cab_auto_fare: cleanText(cell(rowArr, map.cab_auto_fare)),
      payment_status: normalizePaymentStatus(cell(rowArr, map.payment_status)),
      final_bill_amount: toNumber(cell(rowArr, map.final_bill_amount)),
      payment_mode: normalizePaymentMode(cell(rowArr, map.payment_mode)),
      payment_received_date: parseDateValue(cell(rowArr, map.payment_received_date)),
      billing_name: billingName,
      billing_address: cleanText(cell(rowArr, map.billing_address)),
      gst_no: cleanText(cell(rowArr, map.gst_no)),
      invoice_no: cleanText(cell(rowArr, map.invoice_no)),
      invoice_date: parseDateValue(cell(rowArr, map.invoice_date)),
      client_id: clientId,
      content: cleanText(cell(rowArr, map.content)),
      remark: cleanText(cell(rowArr, map.remark)),
      src_sheet: sheetName,
      src_row: r + 1,
      needs_review: needsReview,
    });
  }

  if (!dryRun) {
    await db.from("work_days").upsert(
      {
        work_date: sd.date,
        is_sunday: sd.isSunday,
        note: noteParts.length ? [...new Set(noteParts)].join(" · ") : null,
        walker_count,
        biker_count,
        src_sheet: sheetName,
      },
      { onConflict: "work_date" },
    );
    await db.from("daily_assignments").delete().eq("work_date", sd.date);
    if (assignments.length) {
      const { error } = await db.from("daily_assignments").insert(assignments);
      if (error) throw new Error(`assignments insert (${sheetName}): ${error.message}`);
    }
    await chunkedUpsert("deliveries", deliveries, "src_sheet,src_row");
  }

  return { date: sd.date, deliveries: deliveries.length, assignments: assignments.length };
}

// --------------------------------------------------------------------------
async function main() {
  loadEnv();
  const { file, month, dryRun } = parseArgs();
  if (!file) {
    console.error('Missing --file="/path/to/workbook.xlsx"');
    process.exit(1);
  }
  if (!dryRun) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local).");
      process.exit(1);
    }
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }

  console.log(`Reading ${file}${dryRun ? " (dry run)" : ""}…`);
  const wb = XLSX.readFile(file, { cellDates: true });

  const k = await importKnights(wb, dryRun);
  console.log(`Knights: ${k.knightCount} · salary rows: ${k.salaryCount}`);
  const c = await importClients(wb, dryRun);
  console.log(`Clients: ${c.count}`);
  const rt = await importRates(wb, dryRun);
  console.log(`Rate tiers: ${rt.count}`);

  const daily = wb.SheetNames.filter((s) => {
    const sd = parseSheetDate(s);
    if (!sd) return false;
    return month ? sd.date.startsWith(month) : true;
  });
  console.log(`Daily sheets to import: ${daily.length}${month ? ` (month ${month})` : ""}`);

  let totalDeliveries = 0;
  let totalAssignments = 0;
  let days = 0;
  for (const name of daily) {
    const res = await importDay(wb, name, k.rosterMap, c.map, dryRun);
    if (res) {
      days++;
      totalDeliveries += res.deliveries;
      totalAssignments += res.assignments;
      console.log(`  ${name.padEnd(20)} → ${res.deliveries} deliveries, ${res.assignments} lineup`);
    }
  }

  console.log(
    `\nDone${dryRun ? " (dry run — nothing written)" : ""}: ${days} days, ${totalDeliveries} deliveries, ${totalAssignments} lineup rows.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
