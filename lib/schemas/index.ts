import { z } from "zod";

// ---- shared field helpers (transform-based so types infer cleanly) ---------
function blankToNull(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v;
}
function toNumOrNull(v: unknown): number | null {
  const x = blankToNull(v);
  if (x === null) return null;
  const n = typeof x === "number" ? x : Number(String(x).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** nullable trimmed string ("" → null) */
const nstr = z.any().transform((v): string | null => {
  const x = blankToNull(v);
  return x === null ? null : String(x).trim();
});
/** nullable number (handles "₹ 1,234") */
const nnum = z.any().transform(toNumOrNull);
/** number defaulting to 0 */
const num0 = z.any().transform((v): number => toNumOrNull(v) ?? 0);
/** nullable date string, validated as YYYY-MM-DD (else null) */
const ndate = z.any().transform((v): string | null => {
  const x = blankToNull(v);
  if (x === null) return null;
  const s = String(x).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
});
/** nullable uuid string (else null) */
const nuuid = z.any().transform((v): string | null => {
  const x = blankToNull(v);
  if (x === null) return null;
  const s = String(x).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
});

const modeOfBookingField = z.any().transform((v): "b2b" | "online" | null => {
  const x = blankToNull(v);
  if (x === null) return null;
  const s = String(x).trim().toLowerCase();
  return s === "b2b" || s === "online" ? (s as "b2b" | "online") : null;
});
const paymentStatusField = z.any().transform((v): "paid" | "unpaid" | "free" | "partial" | null => {
  const x = blankToNull(v);
  if (x === null) return null;
  const s = String(x).trim().toLowerCase();
  return s === "paid" || s === "unpaid" || s === "free" || s === "partial" ? (s as any) : null;
});
const roleField = z.any().transform((v): "walker" | "biker" | null => {
  const x = blankToNull(v);
  if (x === null) return null;
  const s = String(x).trim().toLowerCase();
  return s === "walker" || s === "biker" ? (s as "walker" | "biker") : null;
});
const assignmentStatusField = z.any().transform((v): "assigned" | "cancelled" =>
  String(v ?? "").trim().toLowerCase() === "cancelled" ? "cancelled" : "assigned",
);
const fulfillmentStatusField = z.any().transform(
  (v): "placed" | "picked_up" | "in_transit" | "delivered" | "cancelled" => {
    const s = String(v ?? "").trim().toLowerCase().replace(/[\s-]/g, "_");
    return s === "picked_up" || s === "in_transit" || s === "delivered" || s === "cancelled"
      ? (s as "picked_up" | "in_transit" | "delivered" | "cancelled")
      : "placed";
  },
);
const lineupStatusField = z.any().transform((v): "working" | "leave" | "half_day" => {
  const s = String(v ?? "").trim().toLowerCase().replace(/[\s-]/g, "_");
  return s === "leave" || s === "half_day" ? (s as "leave" | "half_day") : "working";
});

// month accepts "YYYY-MM" or "YYYY-MM-DD" and normalizes to the 1st of month.
const monthDate = z.string().transform((v, ctx) => {
  const m = v.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!m) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected month as YYYY-MM" });
    return z.NEVER;
  }
  return `${m[1]}-${m[2]}-01`;
});

// ---- deliveries ------------------------------------------------------------
export const deliverySchema = z.object({
  serial_no: nnum,
  booking_date: ndate,
  task_date: ndate,
  mode_of_booking: modeOfBookingField,

  sender_name: nstr,
  sender_last_name: nstr,

  pickup_location: nstr,
  pickup_time_window: nstr,
  pickup_actual_time: nstr,

  drop_location: nstr,
  drop_recipient_name: nstr,
  drop_time_window: nstr,
  drop_actual_time: nstr,

  knight_id: nuuid,
  knight_name: nstr,
  assignment_status: assignmentStatusField,
  fulfillment_status: fulfillmentStatusField,

  fees: nnum,
  kms: nnum,
  working_hours: nstr,
  cod_remark: nstr,
  cab_auto_fare: nstr,
  payment_status: paymentStatusField,
  final_bill_amount: nnum,
  payment_mode: nstr,
  payment_received_date: ndate,

  billing_name: nstr,
  billing_address: nstr,
  gst_no: nstr,
  invoice_no: nstr,
  invoice_date: ndate,
  client_id: nuuid,

  content: nstr,
  remark: nstr,

  needs_review: z.boolean().optional(),
});
export const deliveryUpdateSchema = deliverySchema.partial();
export type DeliveryInput = z.infer<typeof deliverySchema>;

// ---- knights ---------------------------------------------------------------
export const knightSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  display_name: z.string().trim().min(1, "Display name is required"),
  role: roleField,
  joining_date: ndate,
  default_location: nstr,
  active: z.boolean().default(true),
  note: nstr,
});
export const knightUpdateSchema = knightSchema.partial();
export type KnightInput = z.infer<typeof knightSchema>;

// ---- salaries --------------------------------------------------------------
export const salarySchema = z.object({
  knight_id: z.string().uuid(),
  month: monthDate,
  travel: num0,
  salary: num0,
  total: nnum,
});
export type SalaryInput = z.infer<typeof salarySchema>;

// ---- clients ---------------------------------------------------------------
export const clientSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required"),
  company_name: nstr,
  address: nstr,
  gst_no: nstr,
  phone: nstr,
  note: nstr,
});
export const clientUpdateSchema = clientSchema.partial();
export type ClientInput = z.infer<typeof clientSchema>;

// ---- rate tiers ------------------------------------------------------------
export const rateTierSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  label: nstr,
  min_km: nnum,
  max_km: nnum,
  fee: nnum,
  fee_ex_gst: nnum,
  gst_amount: nnum,
  effective_from: ndate,
  is_current: z.boolean().default(true),
  note: nstr,
});
export const rateTierUpdateSchema = rateTierSchema.partial();
export type RateTierInput = z.infer<typeof rateTierSchema>;

// ---- daily lineup ----------------------------------------------------------
export const assignmentSchema = z.object({
  knight_id: nuuid,
  knight_name: nstr,
  role: roleField,
  location: nstr,
  shift_time: nstr,
  status: lineupStatusField,
  note: nstr,
  position: nnum,
});

export const lineupSchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date as YYYY-MM-DD"),
  is_sunday: z.boolean().optional(),
  note: nstr,
  assignments: z.array(assignmentSchema).default([]),
});
export type LineupInput = z.infer<typeof lineupSchema>;
