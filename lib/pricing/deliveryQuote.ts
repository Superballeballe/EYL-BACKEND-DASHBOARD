export type RateTierRow = {
  provider: string;
  min_km: number | null;
  max_km: number | null;
  fee: number | null;
  note?: string | null;
};

export type PricingSurchargeRow = {
  code: string;
  label: string;
  amount: number;
};

export type HandlingFlags = {
  isCake?: boolean;
  isFood?: boolean;
  delicateHandling?: boolean;
  keepUpright?: boolean;
  isLiquid?: boolean;
  temperatureSensitive?: boolean;
  surchargeCodes?: string[];
};

export type WalkerTransportMode = "cab" | "public_transit";

export type DeliveryQuoteInput = {
  distanceKm: number;
  handling?: HandlingFlags;
  walkerMode?: WalkerTransportMode;
  /** Live cab fare from Uber / ride-hail API when available. */
  cabFareInr?: number | null;
};

export type DeliveryQuote = {
  distanceKm: number;
  recommendedCarrier: "biker" | "walker";
  carrierReason: string;
  baseFare: number;
  surcharges: { code: string; label: string; amount: number }[];
  transportAddon: number;
  /** Walker jobs only: cab/transit is chosen later in the knight app. */
  transportPending?: boolean;
  subtotal: number;
  breakdown: string[];
};

/** Default seed values — overridden when loaded from pricing_config / rate_tiers. */
export const DEFAULT_BIKER_TIERS: RateTierRow[] = [
  { provider: "eyl_biker", min_km: 1, max_km: 1.5, fee: 50, note: "flat" },
  { provider: "eyl_biker", min_km: 1.5, max_km: 7, fee: 25, note: "per_km" },
  { provider: "eyl_biker", min_km: 7, max_km: 14, fee: 21, note: "per_km" },
];

export const DEFAULT_WALKER_PER_KM = 9;
export const DEFAULT_PUBLIC_TRANSPORT_PER_KM = 12;
export const DEFAULT_CAB_FALLBACK_PER_KM = 18;
export const DEFAULT_BIKER_MAX_KM = 14;

export const DEFAULT_SURCHARGES: PricingSurchargeRow[] = [
  { code: "delicate_handling", label: "Dedicated handling / glassware", amount: 50 },
  { code: "upright_cake_food_leakproof", label: "Upright / cake / food / leak-proof", amount: 100 },
];

const BIKER_EXCLUDED_SURCHARGES = new Set(["upright_cake_food_leakproof"]);

function roundInr(value: number) {
  return Math.round(value);
}

/** Progressive biker bands: flat first 1.5 km, then ₹/km for remaining distance. */
export function calculateBikerFare(distanceKm: number, tiers = DEFAULT_BIKER_TIERS) {
  const d = Math.max(distanceKm, 0);
  if (d <= 0) return 0;

  const flatTier = tiers.find((t) => t.note === "flat");
  const flatMax = flatTier?.max_km ?? 1.5;
  const flatFee = flatTier?.fee ?? 50;

  if (d <= flatMax) return roundInr(flatFee);

  let total = flatFee;
  let remaining = d - flatMax;

  const perKmTiers = tiers
    .filter((t) => t.note === "per_km")
    .sort((a, b) => (a.min_km ?? 0) - (b.min_km ?? 0));

  for (const tier of perKmTiers) {
    if (remaining <= 0) break;
    const bandStart = tier.min_km ?? 0;
    const bandEnd = tier.max_km ?? Infinity;
    const bandWidth = Math.max(bandEnd - Math.max(bandStart, flatMax), 0);
    const kmInBand = Math.min(remaining, bandWidth > 0 ? bandWidth : remaining);
    if (kmInBand <= 0) continue;
    total += kmInBand * (tier.fee ?? 0);
    remaining -= kmInBand;
  }

  if (remaining > 0) {
    const last = perKmTiers[perKmTiers.length - 1];
    total += remaining * (last?.fee ?? 21);
  }

  return roundInr(total);
}

export function calculateWalkerFare(
  distanceKm: number,
  opts: {
    walkerPerKm?: number;
    mode?: WalkerTransportMode;
    publicTransportPerKm?: number;
    cabFareInr?: number | null;
    cabFallbackPerKm?: number;
  } = {},
) {
  const d = Math.max(distanceKm, 0);
  const walkerPerKm = opts.walkerPerKm ?? DEFAULT_WALKER_PER_KM;
  const base = roundInr(d * walkerPerKm);

  const mode = opts.mode;
  if (mode == null) {
    return { base, transportAddon: 0, total: base, transportPending: true };
  }

  let transportAddon = 0;
  if (mode === "public_transit") {
    transportAddon = roundInr(d * (opts.publicTransportPerKm ?? DEFAULT_PUBLIC_TRANSPORT_PER_KM));
  } else if (opts.cabFareInr != null && opts.cabFareInr > 0) {
    transportAddon = roundInr(opts.cabFareInr);
  } else {
    transportAddon = roundInr(d * (opts.cabFallbackPerKm ?? DEFAULT_CAB_FALLBACK_PER_KM));
  }

  return { base, transportAddon, total: base + transportAddon, transportPending: false };
}

export function activeSurcharges(
  handling: HandlingFlags = {},
  surcharges = DEFAULT_SURCHARGES,
) {
  const codes = new Set(handling.surchargeCodes ?? []);
  if (handling.delicateHandling) codes.add("delicate_handling");
  if (
    handling.isCake ||
    handling.isFood ||
    handling.keepUpright ||
    handling.isLiquid ||
    handling.temperatureSensitive
  ) {
    codes.add("upright_cake_food_leakproof");
  }

  return surcharges.filter((row) => codes.has(row.code));
}

export function recommendCarrier(
  distanceKm: number,
  handling: HandlingFlags = {},
  opts: { bikerMaxKm?: number; bikerExcludedSurcharges?: string[] } = {},
): { carrier: "biker" | "walker"; reason: string } {
  const bikerMax = opts.bikerMaxKm ?? DEFAULT_BIKER_MAX_KM;
  const excluded = new Set(opts.bikerExcludedSurcharges ?? [...BIKER_EXCLUDED_SURCHARGES]);

  if (distanceKm >= bikerMax) {
    return {
      carrier: "walker",
      reason: `Distance ${distanceKm} km is ${bikerMax} km or more — walker + cab/transit.`,
    };
  }

  const surcharges = activeSurcharges(handling);
  if (surcharges.some((s) => excluded.has(s.code))) {
    return {
      carrier: "walker",
      reason: "Cake, food, or special handling needs a walker.",
    };
  }

  return {
    carrier: "biker",
    reason: `Under ${bikerMax} km with standard handling — biker.`,
  };
}

export function quoteDelivery(input: DeliveryQuoteInput): DeliveryQuote {
  const distanceKm = Math.max(input.distanceKm, 0);
  const handling = input.handling ?? {};
  const { carrier, reason } = recommendCarrier(distanceKm, handling);
  const surcharges = activeSurcharges(handling);
  const surchargeTotal = surcharges.reduce((sum, row) => sum + row.amount, 0);

  let baseFare = 0;
  let transportAddon = 0;
  const breakdown: string[] = [];

  if (carrier === "biker") {
    baseFare = calculateBikerFare(distanceKm);
    breakdown.push(`Biker fare: ₹${baseFare}`);
  } else {
    const walker = calculateWalkerFare(distanceKm, {
      mode: input.walkerMode,
      cabFareInr: input.cabFareInr,
    });
    baseFare = walker.base;
    transportAddon = walker.transportAddon;
    breakdown.push(`Walker ${distanceKm} km × ₹${DEFAULT_WALKER_PER_KM}: ₹${walker.base}`);
    if (walker.transportPending) {
      breakdown.push("Cab or public transport: chosen by knight at pickup");
    } else if (input.walkerMode === "public_transit") {
      breakdown.push(`Public transport: ₹${transportAddon}`);
    } else if (input.cabFareInr) {
      breakdown.push(`Cab (knight / API): ₹${transportAddon}`);
    } else {
      breakdown.push(`Cab estimate: ₹${transportAddon}`);
    }
  }

  for (const row of surcharges) {
    breakdown.push(`${row.label}: ₹${row.amount}`);
  }

  const transportPending =
    carrier === "walker" && input.walkerMode == null;

  return {
    distanceKm,
    recommendedCarrier: carrier,
    carrierReason: reason,
    baseFare,
    surcharges,
    transportAddon,
    transportPending,
    subtotal: baseFare + transportAddon + surchargeTotal,
    breakdown,
  };
}
