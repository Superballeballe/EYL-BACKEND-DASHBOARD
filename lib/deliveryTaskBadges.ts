import {
  deliveryStopCount,
  isDeliveryRoundTrip,
  type DeliveryStop,
} from "@/lib/deliveryRouteDetails";
import { areaLabel } from "@/lib/format";
import type { Delivery } from "@/lib/types";

export type DeliveryTaskBadge = {
  key: "round_trip" | "multidrop";
  label: string;
};

/** Ops-facing route type pills (round trip, multidrop). */
export function getDeliveryTaskBadges(
  delivery: Pick<Delivery, "raw" | "app_order" | "drop_location" | "drop_recipient_name" | "recipient_phone">,
): DeliveryTaskBadge[] {
  if (isDeliveryRoundTrip(delivery)) return [{ key: "round_trip", label: "Round trip" }];
  const stops = deliveryStopCount(delivery);
  if (stops > 1) {
    return [{ key: "multidrop", label: stops > 2 ? `${stops} drops` : "Multidrop" }];
  }
  return [];
}

/**
 * Who the route runs between: "Pickup · Sachin → Drop 1 · Riya → Drop 2 · Amit".
 * A stop without a contact falls back to its first address part (e.g. "Flat 217").
 */
export function formatRoutePeople(
  pickup: { name: string | null; location: string | null },
  stops: DeliveryStop[],
): string {
  const who = (name: string | null, location: string | null) => name?.trim() || areaLabel(location);
  return [
    `Pickup · ${who(pickup.name, pickup.location)}`,
    ...stops.map((stop) => `${stop.label} · ${who(stop.contactName, stop.location)}`),
  ].join(" → ");
}

/** Every drop's recipient in route order, e.g. "Sachin, Sachin Naik, Riya"; "" when none are named. */
export function formatRecipients(stops: DeliveryStop[]): string {
  return stops
    .map((stop) => stop.contactName?.trim())
    .filter(Boolean)
    .join(", ");
}
