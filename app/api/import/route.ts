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
    if (r.success) valid.push(await resolveKnight(r.data));
    else errors.push({ index: i, error: r.error.flatten() });
  }

  if (!valid.length) return badRequest("No valid rows", { errors });

  try {
    const { data, error } = await supabaseAdmin().from("deliveries").insert(valid).select("id");
    if (error) return serverError(error);
    return ok({ inserted: data?.length ?? 0, failed: errors.length, errors });
  } catch (e) {
    return serverError(e);
  }
}
