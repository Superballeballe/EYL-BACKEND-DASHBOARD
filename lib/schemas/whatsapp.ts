import { z } from "zod";

/**
 * Request schemas for /api/integrations/whatsapp/* (the WhatsApp bot).
 * Source of truth: whatsapp-bot docs/eyl-integration-contract.md (v1).
 */

export const MAX_REAL_DROPS = 5;

/** Digits only; "+91 98765 43210", "09876543210" and "919876543210" all become "9876543210". */
export function normalizePhone10(value: unknown): unknown {
  if (typeof value !== "string" && typeof value !== "number") return value;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Indian mobile, 10 digits, no country code. */
export const phone10Schema = z.preprocess(
  normalizePhone10,
  z.string().regex(/^[6-9]\d{9}$/, "Use a 10-digit Indian mobile number"),
);

/** WhatsApp wa_id: digits including the country code. Country support is checked later (422). */
export const waIdSchema = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().replace(/^\+/, "") : v),
  z.string().regex(/^\d{8,15}$/, "wa_id must be digits including the country code"),
);

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const lat = z.number().finite().min(-90).max(90);
const lng = z.number().finite().min(-180).max(180);

export const whatsappStopSchema = z.object({
  line: z.string().trim().min(1).max(500),
  lat,
  lng,
  contact_name: z.string().trim().min(1).max(100),
  contact_phone: phone10Schema,
  building: optText(200),
  floor: optText(50),
  apartment: optText(100),
  company: optText(200),
  instructions: optText(500),
  is_return: z.boolean().optional().default(false),
});
export type WhatsappStop = z.infer<typeof whatsappStopSchema>;

export const whatsappItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  category: optText(50),
  weight_kg: z.number().finite().positive().max(1000).nullish().transform((v) => v ?? null),
  delicate_handling: z.boolean(),
  remarks: optText(500),
});
export type WhatsappItem = z.infer<typeof whatsappItemSchema>;

export const whatsappTierSchema = z.enum(["economy", "standard", "highspeed"]);
export type WhatsappTier = z.infer<typeof whatsappTierSchema>;

export const whatsappCustomerSchema = z.object({
  wa_id: waIdSchema,
  name: optText(100),
});
export type WhatsappCustomerInput = z.infer<typeof whatsappCustomerSchema>;

/**
 * Drops: 1..5 real drops, then optionally one return stop (is_return), which
 * must be last and only on a round trip.
 */
function refineDrops(
  drops: { is_return?: boolean }[],
  roundTrip: boolean,
  ctx: z.RefinementCtx,
) {
  const real = drops.filter((d) => !d.is_return).length;
  if (real < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["drops"], message: "At least one real drop is required" });
  }
  if (real > MAX_REAL_DROPS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["drops"],
      message: `At most ${MAX_REAL_DROPS} drops (plus the return stop)`,
    });
  }
  drops.forEach((d, i) => {
    if (!d.is_return) return;
    if (!roundTrip) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["drops", i, "is_return"], message: "A return stop needs round_trip" });
    } else if (i !== drops.length - 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["drops", i, "is_return"], message: "The return stop must be last" });
    }
  });
}

export const whatsappOrderCreateSchema = z
  .object({
    id: z.string().uuid(),
    wa_id: waIdSchema,
    sender: z.object({ name: z.string().trim().min(1).max(100) }),
    pickup: whatsappStopSchema,
    drops: z.array(whatsappStopSchema).min(1).max(MAX_REAL_DROPS + 1),
    round_trip: z.boolean(),
    item: whatsappItemSchema,
    tier: whatsappTierSchema,
    scheduled_for: z.string().datetime({ offset: true }),
    slot_label: optText(100),
    multi_drop_instructions: optText(1000),
    recipient_alerts_consent: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.pickup.is_return) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pickup", "is_return"], message: "The pickup is not a return stop" });
    }
    refineDrops(data.drops, data.round_trip, ctx);
  });
export type WhatsappOrderCreateInput = z.infer<typeof whatsappOrderCreateSchema>;

const point = z.object({ lat, lng });

export const whatsappQuoteSchema = z
  .object({
    pickup: point,
    stops: z.array(point.extend({ is_return: z.boolean().optional().default(false) })).min(1).max(MAX_REAL_DROPS + 1),
    round_trip: z.boolean(),
    delicate: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const drops = data.stops.map((s) => ({ is_return: s.is_return }));
    // Contract: "the last may be the return" — a flag is optional there, so
    // only enforce position/round-trip rules for stops that set it.
    drops.forEach((d, i) => {
      if (!d.is_return) return;
      if (!data.round_trip || i !== drops.length - 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["stops", i, "is_return"],
          message: "Only the last stop of a round trip can be the return",
        });
      }
    });
    if (drops.filter((d) => !d.is_return).length > MAX_REAL_DROPS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stops"], message: `At most ${MAX_REAL_DROPS} drops` });
    }
  });
export type WhatsappQuoteInput = z.infer<typeof whatsappQuoteSchema>;

export const whatsappOrdersQuerySchema = z.object({
  wa_id: waIdSchema,
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const whatsappEventsQuerySchema = z.object({
  after: z
    .string()
    .trim()
    .regex(/^\d{1,19}$/, "after must be a non-negative integer cursor")
    .default("0")
    .transform((v) => v.replace(/^0+(?=\d)/, "")),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
