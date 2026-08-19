import {
  deliveryStopCount,
  isDeliveryRoundTrip,
  type DeliveryStop,
} from "@/lib/deliveryRouteDetails";
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

export function formatStopRouteSummary(stops: DeliveryStop[]): string | null {
  if (stops.length <= 1) return null;
  return stops.map((stop) => stop.location?.split(" · ")[0]?.trim() || stop.label).join(" → ");
}
