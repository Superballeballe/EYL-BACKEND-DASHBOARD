import { NextResponse } from "next/server";
import type { z } from "zod";
import { badRequest, conflict, notFound, serverError, unauthorized, unprocessable } from "@/lib/api";
import { checkIntegrationKey } from "@/lib/auth";
import { WhatsappError } from "@/lib/server/whatsappOrders";

/**
 * Shared plumbing for /api/integrations/whatsapp/*. Middleware lets this
 * prefix through without a session, so every handler must call
 * requireIntegrationKey first.
 */
export function requireIntegrationKey(req: Request): NextResponse | null {
  return checkIntegrationKey(req) ? null : unauthorized("Invalid integration key");
}

export function whatsappErrorResponse(e: unknown, tag: string): NextResponse {
  if (e instanceof WhatsappError) {
    if (e.status === 422) return unprocessable(e.message, e.code ?? "unprocessable");
    if (e.status === 404) return notFound(e.message);
    if (e.status === 409) return conflict(e.message, e.code);
    if (e.status === 400) return badRequest(e.message);
  }
  console.error(`[whatsapp] ${tag} failed`, e);
  return serverError(e);
}

export function searchParamsObject(req: Request): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of new URL(req.url).searchParams) if (v !== "") out[k] = v;
  return out;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Like lib/api parseBody, but typed by the schema's output (these schemas
 * preprocess/default fields, so input and output types differ).
 */
export async function parseWhatsappBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data: z.output<S> } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON body") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { error: badRequest("Validation failed", parsed.error.flatten()) };
  return { data: parsed.data };
}
