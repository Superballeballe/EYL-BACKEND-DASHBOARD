import type { Delivery } from "@/lib/types";

export type DeliveryStop = {
  label: string;
  location: string | null;
  contactName: string | null;
  contactPhone: string | null;
  instructions: string | null;
  isReturn: boolean;
};

export type DeliveryInstructions = {
  pickup: string | null;
  delivery: string | null;
  multiDrop: string | null;
};

type InvoiceMeta = {
  stops?: unknown;
  is_round_trip?: boolean | string;
  multi_drop_instructions?: string | null;
};

type StopRecord = Record<string, unknown>;

function invoiceRecord(order: Delivery["app_order"]) {
  return Array.isArray(order?.invoices) ? order.invoices[0] : order?.invoices;
}

export function deliveryInvoiceMeta(delivery: Pick<Delivery, "raw" | "app_order">): InvoiceMeta | null {
  const meta = invoiceRecord(delivery.app_order)?.metadata;
  if (meta && typeof meta === "object") return meta as InvoiceMeta;
  if (delivery.raw && typeof delivery.raw === "object") {
    const raw = delivery.raw as Record<string, unknown>;
    if (raw.stops || raw.is_round_trip || raw.multi_drop_instructions) return raw as InvoiceMeta;
  }
  return null;
}

function formatStopLine(stop: StopRecord): string | null {
  const line = stop.line ?? stop.address;
  if (typeof line === "string" && line.trim()) return line.trim();
  const parts = [stop.building, stop.floor, stop.apartment, stop.company]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => String(part).trim());
  return parts.length ? parts.join(" · ") : null;
}

function normalizeStop(stop: StopRecord, index: number, total: number): DeliveryStop {
  const isReturn = stop.isReturn === true || stop.is_return === true;
  return {
    label: total > 1 ? (isReturn ? `Return ${index + 1}` : `Drop ${index + 1}`) : "Drop",
    location: formatStopLine(stop),
    contactName:
      (typeof stop.contactName === "string" ? stop.contactName : null)
      ?? (typeof stop.contact_name === "string" ? stop.contact_name : null),
    contactPhone:
      (typeof stop.contactPhone === "string" ? stop.contactPhone : null)
      ?? (typeof stop.contact_phone === "string" ? stop.contact_phone : null),
    instructions:
      typeof stop.instructions === "string" && stop.instructions.trim()
        ? stop.instructions.trim()
        : null,
    isReturn,
  };
}

/** All delivery stops from invoice metadata, or a single drop from the delivery row. */
export function getDeliveryStops(delivery: Pick<Delivery, "raw" | "app_order" | "drop_location" | "drop_recipient_name" | "recipient_phone">): DeliveryStop[] {
  const meta = deliveryInvoiceMeta(delivery);
  const rawStops = meta?.stops;
  if (Array.isArray(rawStops) && rawStops.length > 0) {
    return rawStops
      .filter((stop): stop is StopRecord => !!stop && typeof stop === "object")
      .map((stop, index, all) => normalizeStop(stop, index, all.length));
  }

  return [
    {
      label: "Drop",
      location: delivery.drop_location,
      contactName: delivery.drop_recipient_name,
      contactPhone: delivery.recipient_phone,
      instructions: null,
      isReturn: false,
    },
  ];
}

export function getDeliveryInstructions(
  delivery: Pick<Delivery, "raw" | "app_order">,
): DeliveryInstructions {
  const meta = deliveryInvoiceMeta(delivery);
  const raw = delivery.raw && typeof delivery.raw === "object" ? (delivery.raw as Record<string, unknown>) : null;
  const order = delivery.app_order as Record<string, unknown> | null | undefined;

  return {
    pickup:
      (typeof order?.pickup_instructions === "string" ? order.pickup_instructions : null)
      ?? (typeof raw?.pickup_instructions === "string" ? raw.pickup_instructions : null),
    delivery:
      (typeof order?.delivery_instructions === "string" ? order.delivery_instructions : null)
      ?? (typeof raw?.delivery_instructions === "string" ? raw.delivery_instructions : null),
    multiDrop:
      (typeof meta?.multi_drop_instructions === "string" ? meta.multi_drop_instructions : null)
      ?? (typeof raw?.multi_drop_instructions === "string" ? raw.multi_drop_instructions : null),
  };
}

export function isDeliveryRoundTrip(
  delivery: Pick<Delivery, "raw" | "app_order" | "drop_location" | "drop_recipient_name" | "recipient_phone">,
): boolean {
  const meta = deliveryInvoiceMeta(delivery);
  if (meta?.is_round_trip === true || meta?.is_round_trip === "true") return true;
  return getDeliveryStops(delivery).some((stop) => stop.isReturn);
}

export function deliveryStopCount(delivery: Pick<Delivery, "raw" | "app_order" | "drop_location" | "drop_recipient_name" | "recipient_phone">): number {
  return getDeliveryStops(delivery).length;
}
