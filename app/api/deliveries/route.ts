import { supabaseAdmin } from "@/lib/supabase/admin";
import { deliverySchema } from "@/lib/schemas";
import { resolveKnight } from "@/lib/server/roster";
import { created, ok, parseBody, serverError } from "@/lib/api";

export const runtime = "nodejs";

const MAX_LIMIT = 500;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const p = url.searchParams;
    const limit = Math.min(Number(p.get("limit")) || 100, MAX_LIMIT);
    const offset = Number(p.get("offset")) || 0;

    let query = supabaseAdmin()
      .from("deliveries")
      .select("*", { count: "exact" })
      .order("task_date", { ascending: false, nullsFirst: false })
      .order("serial_no", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const date = p.get("date");
    if (date) query = query.eq("task_date", date);
    const from = p.get("from");
    if (from) query = query.gte("task_date", from);
    const to = p.get("to");
    if (to) query = query.lte("task_date", to);
    const knightId = p.get("knight_id");
    if (knightId) query = query.eq("knight_id", knightId);
    const paymentStatus = p.get("payment_status");
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    const clientId = p.get("client_id");
    if (clientId) query = query.eq("client_id", clientId);
    if (p.get("needs_review") === "true") query = query.eq("needs_review", true);

    const q = p.get("q");
    if (q) {
      const term = `%${q}%`;
      query = query.or(
        [
          `sender_name.ilike.${term}`,
          `sender_last_name.ilike.${term}`,
          `drop_recipient_name.ilike.${term}`,
          `billing_name.ilike.${term}`,
          `content.ilike.${term}`,
          `pickup_location.ilike.${term}`,
          `drop_location.ilike.${term}`,
          `invoice_no.ilike.${term}`,
        ].join(","),
      );
    }

    const { data, error, count } = await query;
    if (error) return serverError(error);
    return ok({ data, count, limit, offset });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, deliverySchema);
  if ("error" in parsed) return parsed.error;
  try {
    const row = await resolveKnight(parsed.data);
    const { data, error } = await supabaseAdmin()
      .from("deliveries")
      .insert(row)
      .select()
      .single();
    if (error) return serverError(error);
    return created(data);
  } catch (e) {
    return serverError(e);
  }
}
