import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  activeSurcharges,
  calculateBikerFare,
  calculateWalkerFare,
  recommendCarrier,
  quoteDelivery,
  type DeliveryQuoteInput,
  type HandlingFlags,
} from "@/lib/pricing/deliveryQuote";

export type PricingSeed = Awaited<ReturnType<typeof loadPricingSeed>>;

export async function loadPricingSeed() {
  const supabase = supabaseAdmin();
  const [tiersRes, surchargesRes, configRes] = await Promise.all([
    supabase
      .from("rate_tiers")
      .select("provider,min_km,max_km,fee,note")
      .eq("is_current", true)
      .in("provider", [
        "eyl_biker",
        "eyl_walker",
        "eyl_walker_cab",
        "eyl_walker_transit",
      ]),
    supabase
      .from("pricing_surcharges")
      .select("code,label,amount")
      .eq("is_current", true),
    supabase.from("pricing_config").select("key,value"),
  ]);

  const config = Object.fromEntries(
    (configRes.data ?? []).map((row) => [row.key, row.value]),
  );

  const routing = (config.routing_rules ?? {}) as {
    biker_max_distance_km?: number;
    biker_excluded_surcharge_codes?: string[];
  };
  const walkerTransport = (config.walker_transport ?? {}) as {
    public_transport_per_km_inr?: number;
    cab_fare_fallback_per_km_inr?: number;
  };

  const bikerTiers = (tiersRes.data ?? [])
    .filter((row) => row.provider === "eyl_biker")
    .map((row) => ({
      provider: row.provider,
      min_km: row.min_km,
      max_km: row.max_km,
      fee: row.fee,
      note: row.note,
    }));

  const walkerTier = (tiersRes.data ?? []).find((row) => row.provider === "eyl_walker");
  const transitTier = (tiersRes.data ?? []).find(
    (row) => row.provider === "eyl_walker_transit",
  );

  return {
    bikerTiers,
    walkerPerKm: Number(walkerTier?.fee ?? 9),
    publicTransportPerKm:
      Number(walkerTransport.public_transport_per_km_inr) ||
      Number(transitTier?.fee ?? 12),
    cabFallbackPerKm:
      Number(walkerTransport.cab_fare_fallback_per_km_inr) || 18,
    bikerMaxKm: Number(routing.biker_max_distance_km ?? 14),
    bikerExcludedSurcharges: routing.biker_excluded_surcharge_codes ?? [
      "upright_cake_food_leakproof",
    ],
    surcharges: (surchargesRes.data ?? []).map((row) => ({
      code: row.code,
      label: row.label,
      amount: Number(row.amount),
    })),
  };
}

export function quoteFromSeed(input: DeliveryQuoteInput, seed: PricingSeed) {
  const handling = input.handling ?? {};
  const { carrier, reason } = recommendCarrier(input.distanceKm, handling, {
    bikerMaxKm: seed.bikerMaxKm,
    bikerExcludedSurcharges: seed.bikerExcludedSurcharges,
  });

  const surcharges = activeSurcharges(handling, seed.surcharges);
  const surchargeTotal = surcharges.reduce((sum, row) => sum + row.amount, 0);

  let baseFare = 0;
  let transportAddon = 0;
  const breakdown: string[] = [];

  if (carrier === "biker") {
    baseFare = calculateBikerFare(input.distanceKm, seed.bikerTiers);
    breakdown.push(`Biker fare: ₹${baseFare}`);
  } else {
    const walker = calculateWalkerFare(input.distanceKm, {
      walkerPerKm: seed.walkerPerKm,
      mode: input.walkerMode,
      publicTransportPerKm: seed.publicTransportPerKm,
      cabFareInr: input.cabFareInr,
      cabFallbackPerKm: seed.cabFallbackPerKm,
    });
    baseFare = walker.base;
    transportAddon = walker.transportAddon;
    breakdown.push(
      `Walker ${input.distanceKm} km × ₹${seed.walkerPerKm}: ₹${walker.base}`,
    );
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
    distanceKm: input.distanceKm,
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

export function parseQuoteQuery(
  searchParams: URLSearchParams,
): DeliveryQuoteInput & { handling: HandlingFlags } {
  const bool = (key: string) => searchParams.get(key) === "true";

  return {
    distanceKm: Number(searchParams.get("km") ?? searchParams.get("distanceKm") ?? 0),
    handling: {
      isCake: bool("isCake"),
      isFood: bool("isFood"),
      delicateHandling: bool("delicateHandling") || bool("isFragile"),
      keepUpright: bool("keepUpright"),
      isLiquid: bool("isLiquid"),
      temperatureSensitive: bool("temperatureSensitive"),
    },
  };
}

export { quoteDelivery };
