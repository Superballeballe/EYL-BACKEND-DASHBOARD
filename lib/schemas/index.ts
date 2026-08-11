import { z } from "zod";
import { isWithinWorkingHours, workingHoursError } from "@/lib/format";

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
// Legacy values (pre-rename) map onto the current booked/accepted/active/completed vocabulary.
// Note the reordering: assigning a knight used to write "in_transit" and now writes "accepted";
// the explicit pickup action used to write "picked_up" and now writes "active".
const LEGACY_FULFILLMENT_STATUS: Record<string, "booked" | "accepted" | "active" | "completed"> = {
  placed: "booked",
  in_transit: "accepted",
  picked_up: "active",
  delivered: "completed",
};
const fulfillmentStatusField = z.any().transform(
  (v): "booked" | "accepted" | "active" | "completed" | "cancelled" => {
    const s = String(v ?? "").trim().toLowerCase().replace(/[\s-]/g, "_");
    if (s === "accepted" || s === "active" || s === "completed" || s === "cancelled") return s;
    return LEGACY_FULFILLMENT_STATUS[s] ?? "booked";
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
  pickup_lat: nnum,
  pickup_lng: nnum,
  pickup_time_window: nstr,
  pickup_actual_time: nstr,

  drop_location: nstr,
  drop_lat: nnum,
  drop_lng: nnum,
  drop_recipient_name: nstr,
  recipient_phone: nstr,
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

export const createDeliverySchema = deliverySchema.superRefine((data, ctx) => {
  if (data.task_date == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Task date is required", path: ["task_date"] });
  }
  if (data.booking_date == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Booking date is required", path: ["booking_date"] });
  }
  if (data.mode_of_booking == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mode of booking is required", path: ["mode_of_booking"] });
  }
  if (data.serial_no == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Serial number is required", path: ["serial_no"] });
  }
  if (data.sender_name == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sender name is required", path: ["sender_name"] });
  }
  if (data.pickup_location == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pickup location is required", path: ["pickup_location"] });
  }
  if (data.pickup_time_window == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pickup time is required", path: ["pickup_time_window"] });
  } else if (!isWithinWorkingHours(data.pickup_time_window)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: workingHoursError(), path: ["pickup_time_window"] });
  }
  if (data.drop_location == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Drop location is required", path: ["drop_location"] });
  }
  if (data.drop_time_window == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Drop time is required", path: ["drop_time_window"] });
  } else if (!isWithinWorkingHours(data.drop_time_window)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: workingHoursError(), path: ["drop_time_window"] });
  }
  if (data.drop_recipient_name == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recipient name is required", path: ["drop_recipient_name"] });
  }
  if (data.recipient_phone == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Phone number is required", path: ["recipient_phone"] });
  }
  if (data.pickup_actual_time == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pickup actual time is required", path: ["pickup_actual_time"] });
  } else if (!isWithinWorkingHours(data.pickup_actual_time)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: workingHoursError(), path: ["pickup_actual_time"] });
  }
  if (data.drop_actual_time == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Drop actual time is required", path: ["drop_actual_time"] });
  } else if (!isWithinWorkingHours(data.drop_actual_time)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: workingHoursError(), path: ["drop_actual_time"] });
  }
  if (data.fulfillment_status == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Status is required", path: ["fulfillment_status"] });
  }
  if (data.fulfillment_status !== "cancelled" && data.knight_name == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Knight is required", path: ["knight_name"] });
  }
  if (data.working_hours == null && data.fulfillment_status !== "cancelled") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Working hours could not be calculated", path: ["working_hours"] });
  }
  if (data.fees == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fees is required", path: ["fees"] });
  }
  if (data.kms == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kms is required", path: ["kms"] });
  }
  if (data.payment_status == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Payment status is required", path: ["payment_status"] });
  }
  if (data.payment_mode == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Payment mode is required", path: ["payment_mode"] });
  }
  if (data.final_bill_amount == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Final bill amount is required", path: ["final_bill_amount"] });
  }
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

// ---- monthly coupons -------------------------------------------------------
const couponTypeField = z.enum(["percent", "flat"]);

const monthlyCouponBaseSchema = z.object({
  year_month: z.string().regex(/^\d{4}-\d{2}$/, "Expected YYYY-MM"),
  code: z.string().trim().min(1, "Code is required").transform((s) => s.toUpperCase()),
  type: couponTypeField,
  value: z.coerce.number().int().positive("Value must be positive"),
  label: z.string().trim().min(1, "Label is required"),
  active: z.boolean().default(true),
});

function percentMaxRefine(data: { type?: "percent" | "flat"; value?: number }, ctx: z.RefinementCtx) {
  if (data.type === "percent" && data.value != null && data.value > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percent cannot exceed 100", path: ["value"] });
  }
}

export const monthlyCouponSchema = monthlyCouponBaseSchema.superRefine(percentMaxRefine);
export const monthlyCouponUpdateSchema = monthlyCouponBaseSchema.partial().superRefine(percentMaxRefine);
export type MonthlyCouponInput = z.infer<typeof monthlyCouponSchema>;
