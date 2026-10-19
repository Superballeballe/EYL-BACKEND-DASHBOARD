/**
 * The EYL app's handling options and the pricing_surcharges row each one
 * charges: a whole-rupee fee added before GST when the customer picks the
 * option (0 or switched off = free). The app's reprice_order and
 * app_pricing() read these same codes (EYL-APP migration
 * 20261019120000_handling_fees_per_option.sql).
 */
export const APP_HANDLING_FEES = [
  { code: "delicate_handling", option: "Fragile" },
  { code: "liquid", option: "Liquid" },
  { code: "keep_upright", option: "Keep upright" },
] as const;

export const APP_HANDLING_FEE_CODES: string[] = APP_HANDLING_FEES.map((fee) => fee.code);
