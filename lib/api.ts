import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(e: unknown) {
  let message = "Internal server error";
  if (e instanceof Error) {
    message = e.message;
  } else if (e && typeof e === "object" && "message" in e && typeof e.message === "string") {
    message = e.message;
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Parse + validate a JSON request body against a Zod schema. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON body") };
  }
  try {
    return { data: schema.parse(body) };
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: badRequest("Validation failed", e.flatten()) };
    }
    return { error: badRequest("Validation failed") };
  }
}
