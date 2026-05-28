// Map a delivery-table header row to column indexes by NAME, not position.
// The Jan and May layouts differ (and columns shift on manual rows), so we
// detect columns from their header text. "Name"/"Time"/"Actual time" appear
// twice (pickup vs drop), disambiguated by whether we've passed the "Drop"
// column yet.

import { normHeader, type CellValue } from "./normalize";

export type DeliveryField =
  | "serial_no"
  | "booking_date"
  | "task_date"
  | "mode_of_booking"
  | "sender_name"
  | "sender_last_name"
  | "pickup_location"
  | "pickup_time_window"
  | "pickup_actual_time"
  | "drop_location"
  | "drop_recipient_name"
  | "drop_time_window"
  | "drop_actual_time"
  | "knight_name"
  | "fees"
  | "kms"
  | "working_hours"
  | "cod_remark"
  | "cab_auto_fare"
  | "payment_status"
  | "final_bill_amount"
  | "payment_mode"
  | "payment_received_date"
  | "billing_name"
  | "billing_address"
  | "gst_no"
  | "invoice_date"
  | "invoice_no"
  | "content"
  | "remark";

// Unambiguous headers (already normalized via normHeader).
const DICT: Record<string, DeliveryField> = {
  "sr no": "serial_no",
  "srt no": "serial_no",
  "sr number": "serial_no",
  "booking date": "booking_date",
  "task date": "task_date",
  "mode of booking": "mode_of_booking",
  knight: "knight_name",
  fees: "fees",
  kms: "kms",
  "working hours": "working_hours",
  cod: "cod_remark",
  "cod fees collection remark": "cod_remark",
  "cab auto fare": "cab_auto_fare",
  "payment status": "payment_status",
  content: "content",
  "finel biill amount": "final_bill_amount",
  "final bill amount": "final_bill_amount",
  "finel bill amount": "final_bill_amount",
  "final biill amount": "final_bill_amount",
  "payment mode": "payment_mode",
  "payment received date": "payment_received_date",
  "billing name": "billing_name",
  "billing address": "billing_address",
  "gst no": "gst_no",
  "gst details": "gst_no",
  "invoice date": "invoice_date",
  "invoice no": "invoice_no",
  remark: "remark",
};

export function mapDeliveryHeaders(headerRow: CellValue[]): Partial<Record<DeliveryField, number>> {
  const map: Partial<Record<DeliveryField, number>> = {};
  let seenDrop = false;

  headerRow.forEach((raw, idx) => {
    const h = normHeader(raw);
    if (!h) return;

    if (h === "drop") {
      seenDrop = true;
      map.drop_location = idx;
      return;
    }
    if (h === "pick up" || h === "pickup") {
      map.pickup_location = idx;
      return;
    }
    if (h === "name" || h === "first name") {
      if (!seenDrop && map.sender_name === undefined) map.sender_name = idx;
      else if (map.drop_recipient_name === undefined) map.drop_recipient_name = idx;
      return;
    }
    if (h === "last name") {
      map.sender_last_name = idx;
      return;
    }
    if (h === "time") {
      if (!seenDrop) map.pickup_time_window = idx;
      else map.drop_time_window = idx;
      return;
    }
    if (h === "actual time") {
      if (!seenDrop) map.pickup_actual_time = idx;
      else map.drop_actual_time = idx;
      return;
    }
    const f = DICT[h];
    if (f && map[f] === undefined) map[f] = idx;
  });

  return map;
}

/** A row is the delivery header row if it contains both a pickup and a knight column. */
export function isDeliveryHeaderRow(row: CellValue[]): boolean {
  const norms = row.map(normHeader);
  const hasPickup = norms.some((h) => h === "pick up" || h === "pickup");
  const hasKnight = norms.some((h) => h === "knight");
  return hasPickup && hasKnight;
}
