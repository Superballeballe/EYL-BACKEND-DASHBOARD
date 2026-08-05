import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSerialCode, serialPrefix, type SerialPrefix } from "@/lib/serial";

export { formatSerialCode, serialPrefix, type SerialPrefix } from "@/lib/serial";

async function maxSerialForPrefix(db: SupabaseClient, prefix: SerialPrefix): Promise<number> {
  let query = db.from("deliveries").select("serial_no").not("serial_no", "is", null);

  if (prefix === "APPEYL") {
    query = query.or("mode_of_booking.eq.online,app_order_id.not.is.null");
  } else {
    query = query.is("app_order_id", null).or("mode_of_booking.eq.b2b,mode_of_booking.is.null");
  }

  const { data, error } = await query
    .order("serial_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const n = data?.serial_no;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export async function nextSerial(
  db: SupabaseClient,
  mode: "b2b" | "online" | null | undefined,
  appOrderId?: string | null,
) {
  const prefix = serialPrefix(mode, appOrderId);
  const max = await maxSerialForPrefix(db, prefix);
  const serial_no = max + 1;
  return { prefix, serial_no, serial_code: formatSerialCode(mode, serial_no, appOrderId) };
}
