import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deliverySchema } from "@/lib/schemas";
import { resolveKnight } from "@/lib/server/roster";
import { badRequest, ok, serverError } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Bulk-insert deliveries for automation / external apps.
 * Body: { deliveries: DeliveryInput[] }   (requires the x-api-key header)
 * Validates each row; valid rows are inserted, invalid rows reported back.
 *
 * Invoice numbers (EYL-APP 20261104152000): a row without invoice_no is a new
 * delivery and the database issues its EYL/YY-YY/NNNNNN number. A row that
 * carries one is a historical record: it is tagged src_sheet "api-import"
 * (unless it names its own sheet) so the number is kept; an EYL/ number can't
 * be brought in this way. The reply lists each row's invoice number.
 */
const bodySchema = z.object({
  deliveries: z.array(z.unknown()).min(1).max(1000),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const top = bodySchema.safeParse(body);
  if (!top.success) return badRequest("Expected { deliveries: [...] } (1-1000 rows)");

  const valid: Record<string, unknown>[] = [];
  const errors: { index: number; error: unknown }[] = [];

  for (let i = 0; i < top.data.deliveries.length; i++) {
    const r = deliverySchema.safeParse(top.data.deliveries[i]);
    if (r.success) {
      const row: Record<string, unknown> = await resolveKnight(r.data);
      const sheet = (top.data.deliveries[i] as { src_sheet?: unknown })?.src_sheet;
      if (typeof row.invoice_no === "string" && row.invoice_no.trim()) {
        row.src_sheet = typeof sheet === "string" && sheet.trim() ? sheet.trim() : "api-import";
      }
      valid.push(row);
    } else errors.push({ index: i, error: r.error.flatten() });
  }

  if (!valid.length) return badRequest("No valid rows", { errors });

  try {
    const { data, error } = await supabaseAdmin().from("deliveries").insert(valid).select("id, invoice_no");
    if (error) return serverError(error);
    return ok({ inserted: data?.length ?? 0, failed: errors.length, errors, rows: data ?? [] });
  } catch (e) {
    return serverError(e);
  }
}
