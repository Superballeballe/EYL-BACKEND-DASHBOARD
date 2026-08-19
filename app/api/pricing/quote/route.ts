import { badRequest, ok, serverError } from "@/lib/api";
import { loadPricingSeed, parseQuoteQuery, quoteFromSeed } from "@/lib/pricing/loadPricingSeed";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WalkerTransportMode } from "@/lib/pricing/deliveryQuote";

export const runtime = "nodejs";

/** Final walker quote after the knight picks cab vs public transport in the knight app. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { orderId?: string };
    if (!body.orderId) return badRequest("orderId is required");

    const db = supabaseAdmin();
    const [orderRes, deliveryRes] = await Promise.all([
      db
        .from("orders")
        .select("id, walker_transport_mode, walker_transport_fare_inr")
        .eq("id", body.orderId)
        .maybeSingle(),
      db
        .from("deliveries")
        .select("kms")
        .eq("app_order_id", body.orderId)
        .maybeSingle(),
    ]);
    if (orderRes.error) return serverError(orderRes.error);
    if (deliveryRes.error) return serverError(deliveryRes.error);

    const order = orderRes.data;
    if (!order) return badRequest("order not found");
    if (!order.walker_transport_mode) {
      return badRequest("walker transport not set by knight yet");
    }

    const distanceKm = Number(deliveryRes.data?.kms ?? 0);
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return badRequest("order distance unavailable");
    }

    const seed = await loadPricingSeed();
    const quote = quoteFromSeed(
      {
        distanceKm,
        walkerMode: order.walker_transport_mode as WalkerTransportMode,
        cabFareInr: order.walker_transport_fare_inr,
      },
      seed,
    );

    return ok({ data: quote });
  } catch (e) {
    return serverError(e);
  }
}

export async function GET(req: Request) {
  try {
    const input = parseQuoteQuery(new URL(req.url).searchParams);
    if (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0) {
      return badRequest("km (distance) must be a positive number");
    }

    const seed = await loadPricingSeed();
    const quote = quoteFromSeed(input, seed);

    return ok({
      data: quote,
      seed: {
        bikerMaxKm: seed.bikerMaxKm,
        walkerPerKm: seed.walkerPerKm,
        publicTransportPerKm: seed.publicTransportPerKm,
        cabFallbackPerKm: seed.cabFallbackPerKm,
        surcharges: seed.surcharges,
        transportChoiceSource: "knight_app",
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
