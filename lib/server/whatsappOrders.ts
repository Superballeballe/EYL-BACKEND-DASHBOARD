import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { composeAddressLine } from "@/lib/addressFormat";
import { GST_SAC, SELLER_GST } from "@/lib/gst";
import type {
  WhatsappOrderCreateInput,
  WhatsappQuoteInput,
  WhatsappStop,
} from "@/lib/schemas/whatsapp";

/**
 * Server-only logic behind /api/integrations/whatsapp/* (the WhatsApp bot).
 * Contract: whatsapp-bot docs/eyl-integration-contract.md (v1).
 *
 * Every function takes the service-role client as `db` so tests can pass a
 * fake. Business-rule failures throw WhatsappError, which the routes turn into
 * `{ error, code }` responses (lib/api.ts).
 */

export type Db = Pick<SupabaseClient, "from" | "rpc" | "functions" | "auth">;

export type WhatsappErrorCode =
  | "unsupported_country"
  | "outside_service_area"
  | "pickup_too_soon"
  | "pickup_too_far"
  | "not_payable"
  | "deadline_passed";

export class WhatsappError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 422 | 500,
    message: string,
    readonly code?: WhatsappErrorCode | string,
  ) {
    super(message);
    this.name = "WhatsappError";
  }
}

type PgError = { code?: string | null; message?: string | null; details?: string | null; hint?: string | null };

// ---- phones -----------------------------------------------------------------

/** "919876543210" → "9876543210"; null for anything but an Indian mobile wa_id. */
export function phone10FromWaId(waId: string): string | null {
  const digits = String(waId ?? "").trim().replace(/^\+/, "");
  const m = /^91([6-9]\d{9})$/.exec(digits);
  return m ? m[1] : null;
}

/** Supabase auth stores phones as E.164 digits without "+": "91XXXXXXXXXX". */
export function authPhoneFromPhone10(phone10: string): string {
  return `91${phone10}`;
}

// ---- customers --------------------------------------------------------------

export type WhatsappCustomer = {
  user_id: string;
  created: boolean;
  phone10: string;
  name: string | null;
};

const ALREADY_REGISTERED = /already (been )?registered|already exists|phone_exists|duplicate/i;

export function isAlreadyRegisteredError(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.code === "phone_exists" || error.code === "user_already_exists") return true;
  return ALREADY_REGISTERED.test(error.message ?? "");
}

const LIST_USERS_PER_PAGE = 1000;
const LIST_USERS_MAX_PAGES = 100;

/** Find an auth user by phone. GoTrue has no phone filter, so page through. */
export async function findAuthUserIdByPhone(db: Db, authPhone: string): Promise<string | null> {
  const wanted = new Set([authPhone, `+${authPhone}`]);
  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: LIST_USERS_PER_PAGE });
    if (error) throw new WhatsappError(500, `Couldn't look up the customer: ${error.message}`);
    const users = data?.users ?? [];
    const hit = users.find((u) => u.phone && wanted.has(u.phone));
    if (hit) return hit.id;
    if (users.length < LIST_USERS_PER_PAGE) return null;
  }
  return null;
}

async function upsertWhatsappCustomer(
  db: Db,
  row: { wa_id: string; user_id: string; phone10: string; name: string | null },
) {
  let { error } = await db.from("whatsapp_customers").upsert(row, { onConflict: "wa_id" });
  // Tolerate a table without a name column (PostgREST: column not in schema cache).
  if (error && error.code === "PGRST204") {
    const { name: _name, ...rest } = row;
    ({ error } = await db.from("whatsapp_customers").upsert(rest, { onConflict: "wa_id" }));
  }
  if (error) throw new WhatsappError(500, `Couldn't save the WhatsApp customer: ${error.message}`);
}

/**
 * Resolve the EYL user for a WhatsApp number: the linked row if any, else a
 * new phone-confirmed auth user, else the auth user that already owns the
 * phone. Then (re)write whatsapp_customers.
 */
export async function ensureCustomer(db: Db, waId: string, name?: string | null): Promise<WhatsappCustomer> {
  const phone10 = phone10FromWaId(waId);
  if (!phone10) {
    throw new WhatsappError(422, "Only Indian (+91) mobile numbers are supported.", "unsupported_country");
  }
  const cleanName = name?.trim() || null;

  const existing = await db
    .from("whatsapp_customers")
    .select("*")
    .eq("wa_id", waId)
    .maybeSingle();
  if (existing.error) {
    throw new WhatsappError(500, `Couldn't load the WhatsApp customer: ${existing.error.message}`);
  }
  if (existing.data?.user_id) {
    const userId = existing.data.user_id as string;
    if (cleanName) await upsertWhatsappCustomer(db, { wa_id: waId, user_id: userId, phone10, name: cleanName });
    const stored = (existing.data as { name?: string | null }).name ?? null;
    return { user_id: userId, created: false, phone10, name: cleanName ?? stored };
  }

  const authPhone = authPhoneFromPhone10(phone10);
  let userId: string | null = null;
  let created = false;
  const { data, error } = await db.auth.admin.createUser({
    phone: authPhone,
    phone_confirm: true,
    user_metadata: { name: cleanName ?? "", phone: phone10, source: "whatsapp" },
  });
  if (!error && data?.user?.id) {
    userId = data.user.id;
    created = true;
  } else if (isAlreadyRegisteredError(error)) {
    userId = await findAuthUserIdByPhone(db, authPhone);
    if (!userId) {
      throw new WhatsappError(409, "This phone is registered, but its account couldn't be found.");
    }
  } else {
    throw new WhatsappError(500, `Couldn't create the customer: ${error?.message ?? "no user returned"}`);
  }

  await upsertWhatsappCustomer(db, { wa_id: waId, user_id: userId, phone10, name: cleanName });
  return { user_id: userId, created, phone10, name: cleanName };
}

// ---- create_booking payload ------------------------------------------------

/** A stop as the consumer app stores it (order.addresses.drops / invoice_metadata.stops). */
export type AppStop = {
  line: string;
  company: string | null;
  building: string | null;
  floor: string | null;
  apartment: string | null;
  lat: number;
  lng: number;
  contactName: string;
  contactPhone: string;
  instructions: string | null;
  isReturn: boolean;
};

function appStop(stop: WhatsappStop, isReturn = !!stop.is_return): AppStop {
  return {
    line: stop.line,
    company: stop.company ?? null,
    building: stop.building ?? null,
    floor: stop.floor ?? null,
    apartment: stop.apartment ?? null,
    lat: stop.lat,
    lng: stop.lng,
    contactName: stop.contact_name,
    contactPhone: stop.contact_phone,
    instructions: stop.instructions ?? null,
    isReturn,
  };
}

function addressObject(stop: WhatsappStop) {
  return {
    line: stop.line,
    company: stop.company ?? null,
    building: stop.building ?? null,
    floor: stop.floor ?? null,
    apartment: stop.apartment ?? null,
    lat: stop.lat,
    lng: stop.lng,
    contact_name: stop.contact_name,
    contact_phone: stop.contact_phone,
  };
}

/**
 * Stops in route order. A round trip always ends with the return stop: the
 * bot's is_return stop, or (as the app's buildRoundTripReturnDrop does) one
 * built from the pickup.
 */
export function routeStops(input: WhatsappOrderCreateInput): AppStop[] {
  const real = input.drops.filter((d) => !d.is_return);
  const stops = real.map((d) => appStop(d, false));
  if (!input.round_trip) return stops;
  const given = input.drops.find((d) => d.is_return);
  const ret = given
    ? appStop(given, true)
    : appStop({ ...input.pickup, instructions: input.multi_drop_instructions ?? null }, true);
  return [...stops, ret];
}

/**
 * Map the bot's order body to the create_booking jsonb the consumer app sends
 * (EYL-APP src/services/bookingService.js buildBookingRpcPayload). Prices are
 * left empty: the reprice_client_invoice trigger prices the order server-side
 * once create_booking_as has set the customer's identity.
 */
export function buildCreateBookingPayload(
  input: WhatsappOrderCreateInput,
  customer: { user_id: string; phone10: string },
) {
  const stops = routeStops(input);
  const first = input.drops.find((d) => !d.is_return)!;
  const pickup = addressObject(input.pickup);
  const delivery = addressObject(first);
  const multiDrop = input.multi_drop_instructions ?? null;
  const schedule = { slotId: null, label: input.slot_label ?? null, scheduledFor: input.scheduled_for };
  const remarks =
    [input.item.remarks, input.slot_label ? `Pickup: ${input.slot_label}` : null].filter(Boolean).join(" · ") || null;

  return {
    id: input.id,
    user_id: customer.user_id,
    user_snapshot: { name: input.sender.name, phone: customer.phone10, email: null },
    pickup,
    delivery,
    stops: stops.map((stop, index) => ({ ...stop, sort_order: index + 1 })),
    multi_drop_instructions: multiDrop,
    pickup_address: composeAddressLine(input.pickup),
    pickup_lat: input.pickup.lat,
    pickup_lng: input.pickup.lng,
    delivery_address: composeAddressLine(first),
    delivery_lat: first.lat,
    delivery_lng: first.lng,
    pickup_instructions: input.pickup.instructions ?? null,
    delivery_instructions: first.instructions ?? null,
    recipient_name: first.contact_name,
    recipient_phone: first.contact_phone,
    delivery_tier: input.tier,
    scheduled_for: input.scheduled_for,
    payment_method: "upi",
    payment_status: "pending",
    payment_provider: null,
    payment_provider_ref: null,
    paid_at: null,
    invoice_type: "tax_invoice",
    item: {
      description: input.item.description,
      category: input.item.category ?? null,
      weight_kg: input.item.weight_kg ?? null,
      delicate_handling: input.item.delicate_handling,
      remarks,
      images: [] as string[],
    },
    amounts: [] as unknown[],
    invoice_metadata: {
      channel: "whatsapp",
      payment_label: "Payment link",
      coupon: null,
      schedule,
      gstin_verification: null,
      stops,
      multi_drop_instructions: multiDrop,
      is_round_trip: input.round_trip,
      return_instructions: input.round_trip ? multiDrop : null,
      parcel_type: null,
      handling: null,
      razorpay_order_id: null,
      razorpay_payment_id: null,
    },
    tax: {
      is_gst: true,
      seller_legal_name: SELLER_GST.legalName,
      seller_gstin: SELLER_GST.gstin,
      seller_address: SELLER_GST.address,
      seller_state_code: SELLER_GST.stateCode,
      buyer_legal_name: null,
      buyer_gstin: null,
      buyer_address: null,
      buyer_state_code: null,
      place_of_supply: SELLER_GST.stateCode,
      is_interstate: false,
      hsn_sac: GST_SAC,
      taxable_value: 0,
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      igst_rate: 0,
      igst_amount: 0,
    },
  };
}

// ---- error mapping -----------------------------------------------------------

const PICKUP_WINDOW_DAYS = 30;

/**
 * Map a Postgres/PostgREST error from create_booking_as / quote_booking to a
 * contract error, using the messages the EYL-APP guards raise:
 *   'pickup is outside the service area' / 'drop-off …' / 'route …' (22023, reprice_order)
 *   'no price band covers % km' (22023, eyl_distance_fare)
 *   'pickup time not allowed: pick a slot at least 2 hours away' (P0001,
 *      guard_client_pickup_time — also raised past the 30-day limit)
 *   'pickup time not allowed: pick an upcoming slot' (older guard)
 *   'payment window expired' / 'confirmation window has closed'
 * Plain snake_case tokens (outside_service_area, …) are matched too.
 */
export function mapBookingError(
  error: PgError,
  ctx: { scheduledFor?: string | null; now?: Date } = {},
): WhatsappError {
  const message = String(error.message ?? "");
  const text = `${message} ${error.details ?? ""} ${error.hint ?? ""}`;

  if (/outside[ _]the[ _]service[ _]area|outside_service_area|no price band covers/i.test(text)) {
    return new WhatsappError(422, "That address is outside our service area.", "outside_service_area");
  }
  if (/pickup_too_far/i.test(text)) {
    return new WhatsappError(422, `Pick a pickup within the next ${PICKUP_WINDOW_DAYS} days.`, "pickup_too_far");
  }
  if (/pickup_too_soon/i.test(text)) {
    return new WhatsappError(422, "That pickup is too soon. Pick a slot at least 2 hours away.", "pickup_too_soon");
  }
  if (/pickup time not allowed/i.test(text)) {
    const now = ctx.now ?? new Date();
    const at = ctx.scheduledFor ? Date.parse(ctx.scheduledFor) : NaN;
    const tooFar = Number.isFinite(at) && at > now.getTime() + (PICKUP_WINDOW_DAYS - 1) * 86_400_000;
    return tooFar
      ? new WhatsappError(422, `Pick a pickup within the next ${PICKUP_WINDOW_DAYS} days.`, "pickup_too_far")
      : new WhatsappError(422, "That pickup is too soon. Pick a slot at least 2 hours away.", "pickup_too_soon");
  }
  if (/deadline_passed|deadline passed|payment window (has )?(expired|closed)|confirmation window has closed/i.test(text)) {
    return new WhatsappError(422, "The payment window for this booking has closed.", "deadline_passed");
  }
  if (/not[ _]payable|payment is not pending|already paid/i.test(text)) {
    return new WhatsappError(422, "This booking can't be paid now.", "not_payable");
  }
  if (error.code === "23505") {
    return new WhatsappError(409, "This order already exists.");
  }
  if (error.code === "22023" || error.code === "22P02" || error.code === "22007" || error.code === "23514") {
    return new WhatsappError(400, message || "The booking was rejected as invalid.");
  }
  return new WhatsappError(500, message || "Booking failed.");
}

/** Edge-function `code`s (razorpay-payment-link, razorpay-order) → contract codes. */
const PAYMENT_LINK_CODES: Record<string, WhatsappErrorCode> = {
  not_payable: "not_payable",
  not_pending: "not_payable",
  already_paid: "not_payable",
  deadline_passed: "deadline_passed",
  payment_window_closed: "deadline_passed",
  slot_too_soon: "deadline_passed",
  expired: "deadline_passed",
};

export function mapPaymentLinkError(status: number, payload: unknown): WhatsappError {
  const body = (payload && typeof payload === "object" ? payload : {}) as { error?: unknown; code?: unknown };
  const message = typeof body.error === "string" && body.error ? body.error : "Couldn't create the payment link.";
  const code = typeof body.code === "string" ? PAYMENT_LINK_CODES[body.code] : undefined;
  if (code) return new WhatsappError(422, message, code);
  if (status === 404) return new WhatsappError(404, message);
  if (status === 409 || status === 422) {
    const mapped = mapBookingError({ message });
    return mapped.status === 422 ? mapped : new WhatsappError(422, message, "not_payable");
  }
  return new WhatsappError(500, message);
}

// ---- payment links -------------------------------------------------------------

export type PaymentLink = {
  payment_url: string;
  payment_link_id: string;
  expires_at: string | null;
  total: number;
};

/** razorpay-payment-link with the service-role key (lib/server/opsRefund.ts pattern). */
export async function invokePaymentLink(db: Db, orderId: string): Promise<PaymentLink> {
  const { data, error } = await db.functions.invoke("razorpay-payment-link", {
    body: { order_id: orderId, action: "create" },
  });
  if (error) {
    let status = 500;
    let payload: unknown = null;
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      status = error.context.status;
      try {
        payload = await error.context.json();
      } catch {
        payload = null;
      }
    }
    const mapped = mapPaymentLinkError(status, payload);
    console.error("[whatsapp] payment link failed", orderId, status, mapped.code, error.message);
    throw mapped;
  }
  const link = (data ?? {}) as Partial<PaymentLink> & { error?: string; code?: string };
  if (typeof link.payment_url !== "string" || !link.payment_url || typeof link.payment_link_id !== "string") {
    throw mapPaymentLinkError(link.code ? 422 : 500, link);
  }
  return {
    payment_url: link.payment_url,
    payment_link_id: link.payment_link_id,
    expires_at: link.expires_at ?? null,
    total: Number(link.total ?? 0),
  };
}

// ---- orders ----------------------------------------------------------------------

type BookingResult = {
  id: string;
  order_code: string;
  status: string;
  total_amount: number | null;
  invoice_number: string | null;
  payment_deadline_at: string | null;
  confirm_deadline_at: string | null;
};

export type CreatedWhatsappOrder = {
  order_id: string;
  order_code: string;
  status: string;
  total: number;
  invoice_number: string | null;
  payment_url: string;
  payment_link_id: string;
  payment_deadline_at: string | null;
};

const CREATE_ATTEMPTS = 3;

/**
 * POST /orders. Idempotent on input.id: a replay (the order already exists
 * for this customer) re-runs create_booking_as, which returns the same order,
 * and razorpay-payment-link, which returns the active link.
 */
export async function createWhatsappOrder(
  db: Db,
  input: WhatsappOrderCreateInput,
  now: Date = new Date(),
): Promise<{ replay: boolean; order: CreatedWhatsappOrder }> {
  const customer = await ensureCustomer(db, input.wa_id, input.sender.name);

  const [link, existing] = await Promise.all([
    db.from("whatsapp_order_links").select("wa_id").eq("order_id", input.id).maybeSingle(),
    db.from("orders").select("id, user_id").eq("id", input.id).maybeSingle(),
  ]);
  const loadError = link.error ?? existing.error;
  if (loadError) throw new WhatsappError(500, `Couldn't check the order: ${loadError.message}`);
  if (link.data && link.data.wa_id !== input.wa_id) {
    throw new WhatsappError(409, "This order id belongs to another WhatsApp customer.");
  }
  if (existing.data && existing.data.user_id !== customer.user_id) {
    throw new WhatsappError(409, "This order id is already used.");
  }
  const replay = Boolean(link.data || existing.data);

  const payload = buildCreateBookingPayload(input, customer);
  let booking: BookingResult | null = null;
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await db.rpc("create_booking_as", {
      p_user_id: customer.user_id,
      p_payload: payload,
    });
    if (!error) {
      booking = data as BookingResult;
      break;
    }
    // A clash on the random order code: create_booking picks a new one on retry.
    if (error.code === "23505" && attempt < CREATE_ATTEMPTS) continue;
    const mapped = mapBookingError(error, { scheduledFor: input.scheduled_for, now });
    if (mapped.status === 500) console.error("[whatsapp] create_booking_as failed", input.id, error.code, error.message);
    throw mapped;
  }
  if (!booking?.id) throw new WhatsappError(500, "Booking returned no order.");

  const { error: linkError } = await db.from("whatsapp_order_links").insert({
    order_id: booking.id,
    wa_id: input.wa_id,
    recipient_alerts_consent: input.recipient_alerts_consent,
  });
  if (linkError && linkError.code !== "23505") {
    throw new WhatsappError(500, `Couldn't link the order to WhatsApp: ${linkError.message}`);
  }

  const payment = await invokePaymentLink(db, booking.id);
  return {
    replay,
    order: {
      order_id: booking.id,
      order_code: booking.order_code,
      status: booking.status,
      total: Number(booking.total_amount ?? payment.total ?? 0),
      invoice_number: booking.invoice_number ?? null,
      payment_url: payment.payment_url,
      payment_link_id: payment.payment_link_id,
      payment_deadline_at: booking.payment_deadline_at ?? null,
    },
  };
}

/** True when the order was placed through WhatsApp (has a link row). */
export async function loadOrderLink(db: Db, orderId: string): Promise<{ wa_id: string } | null> {
  const { data, error } = await db
    .from("whatsapp_order_links")
    .select("order_id, wa_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new WhatsappError(500, `Couldn't load the order: ${error.message}`);
  return data ? { wa_id: data.wa_id as string } : null;
}

/** POST /orders/:id/payment-link — only for WhatsApp orders. */
export async function reissuePaymentLink(db: Db, orderId: string): Promise<PaymentLink> {
  if (!(await loadOrderLink(db, orderId))) throw new WhatsappError(404, "Order not found");
  return invokePaymentLink(db, orderId);
}

export const WHATSAPP_ORDER_SELECT =
  "id, order_code, status, rider_name, scheduled_for, pickup, delivery, pickup_address, delivery_address, total_price, payment_deadline_at, confirm_deadline_at, created_at, invoices(payment_status, total_amount, metadata)";

export type WhatsappOrderView = {
  order_id: string;
  order_code: string;
  status: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  total: number;
  knight_name: string | null;
  scheduled_for: string | null;
  pickup_line: string;
  drop_lines: string[];
  payment_deadline_at: string | null;
  confirm_deadline_at: string | null;
  tracking_url: string | null;
};

type OrderRow = {
  id: string;
  order_code: string;
  status: string;
  rider_name?: string | null;
  scheduled_for?: string | null;
  pickup?: Record<string, unknown> | null;
  delivery?: Record<string, unknown> | null;
  pickup_address?: string | null;
  delivery_address?: string | null;
  total_price?: number | null;
  payment_deadline_at?: string | null;
  confirm_deadline_at?: string | null;
  invoices?:
    | { payment_status?: string | null; total_amount?: number | null; metadata?: Record<string, unknown> | null }
    | { payment_status?: string | null; total_amount?: number | null; metadata?: Record<string, unknown> | null }[]
    | null;
};

const PAYMENT_STATUSES = new Set(["pending", "paid", "failed", "refunded"]);

function line(stop: unknown, fallback: string | null | undefined): string {
  if (stop && typeof stop === "object") {
    const composed = composeAddressLine(stop as Record<string, unknown>);
    if (composed) return composed;
  }
  return fallback ?? "";
}

/** Shape an orders row (with invoices) as the contract's order view. */
export function toOrderView(row: OrderRow): WhatsappOrderView {
  const invoice = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
  const meta = (invoice?.metadata ?? {}) as { stops?: unknown };
  const stops = Array.isArray(meta.stops) ? (meta.stops as Record<string, unknown>[]) : [];
  const realStops = stops.filter((s) => s && s.isReturn !== true && s.is_return !== true);
  const dropLines = realStops.length
    ? realStops.map((s) => line(s, null)).filter(Boolean)
    : [line(row.delivery, row.delivery_address)].filter(Boolean);
  const paymentStatus = String(invoice?.payment_status ?? "pending");

  return {
    order_id: row.id,
    order_code: row.order_code,
    status: row.status,
    payment_status: (PAYMENT_STATUSES.has(paymentStatus) ? paymentStatus : "pending") as WhatsappOrderView["payment_status"],
    total: Number(invoice?.total_amount ?? row.total_price ?? 0),
    knight_name: row.rider_name?.trim() || null,
    scheduled_for: row.scheduled_for ?? null,
    pickup_line: line(row.pickup, row.pickup_address),
    drop_lines: dropLines,
    payment_deadline_at: row.payment_deadline_at ?? null,
    confirm_deadline_at: row.confirm_deadline_at ?? null,
    tracking_url: null,
  };
}

/** GET /orders/:id — only orders linked in whatsapp_order_links. */
export async function getWhatsappOrder(db: Db, orderId: string): Promise<WhatsappOrderView> {
  if (!(await loadOrderLink(db, orderId))) throw new WhatsappError(404, "Order not found");
  const { data, error } = await db.from("orders").select(WHATSAPP_ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw new WhatsappError(500, `Couldn't load the order: ${error.message}`);
  if (!data) throw new WhatsappError(404, "Order not found");
  return toOrderView(data as unknown as OrderRow);
}

const MAX_LINKS_SCANNED = 1000;

/** GET /orders?wa_id=&limit= — newest first. */
export async function listWhatsappOrders(db: Db, waId: string, limit: number): Promise<WhatsappOrderView[]> {
  const links = await db
    .from("whatsapp_order_links")
    .select("order_id")
    .eq("wa_id", waId)
    .limit(MAX_LINKS_SCANNED);
  if (links.error) throw new WhatsappError(500, `Couldn't load orders: ${links.error.message}`);
  const ids = (links.data ?? []).map((l) => l.order_id as string);
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("orders")
    .select(WHATSAPP_ORDER_SELECT)
    .in("id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new WhatsappError(500, `Couldn't load orders: ${error.message}`);
  return ((data ?? []) as unknown as OrderRow[]).map(toOrderView);
}

// ---- quote ---------------------------------------------------------------------------

export type WhatsappQuote = {
  km: number;
  fare: number;
  handling_fee: number;
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
  currency: "INR";
};

/** POST /quote — quote_booking(p jsonb) gets the validated body as-is. */
export async function quoteWhatsappBooking(db: Db, input: WhatsappQuoteInput): Promise<WhatsappQuote> {
  const { data, error } = await db.rpc("quote_booking", { p: input });
  if (error) throw mapBookingError(error);
  const q = (data ?? {}) as Partial<Record<keyof WhatsappQuote, unknown>>;
  return {
    km: Number(q.km ?? 0),
    fare: Number(q.fare ?? 0),
    handling_fee: Number(q.handling_fee ?? 0),
    taxable: Number(q.taxable ?? 0),
    cgst: Number(q.cgst ?? 0),
    sgst: Number(q.sgst ?? 0),
    total: Number(q.total ?? 0),
    currency: "INR",
  };
}

// ---- events ----------------------------------------------------------------------------

export type WhatsappOrderEvent = {
  id: string;
  order_id: string;
  order_code: string;
  wa_id: string;
  kind: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type EventRow = {
  id: number | string;
  order_id: string;
  wa_id?: string | null;
  order_code?: string | null;
  kind: string;
  status?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

/** GET /events?after=&limit= — the outbox in id order, with order codes. */
export async function listWhatsappEvents(
  db: Db,
  after: string,
  limit: number,
): Promise<{ data: WhatsappOrderEvent[]; next_cursor: string }> {
  const { data, error } = await db
    .from("integration_order_events")
    .select("*")
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw new WhatsappError(500, `Couldn't load events: ${error.message}`);
  const rows = (data ?? []) as EventRow[];
  if (rows.length === 0) return { data: [], next_cursor: after };

  const orderIds = Array.from(new Set(rows.map((r) => r.order_id)));
  const needLinks = rows.some((r) => !r.wa_id);
  const [orders, links] = await Promise.all([
    db.from("orders").select("id, order_code").in("id", orderIds),
    needLinks
      ? db.from("whatsapp_order_links").select("order_id, wa_id").in("order_id", orderIds)
      : Promise.resolve({ data: [] as { order_id: string; wa_id: string }[], error: null }),
  ]);
  const joinError = orders.error ?? links.error;
  if (joinError) throw new WhatsappError(500, `Couldn't load events: ${joinError.message}`);
  const codeById = new Map((orders.data ?? []).map((o) => [o.id as string, o.order_code as string]));
  const waIdByOrder = new Map((links.data ?? []).map((l) => [l.order_id as string, l.wa_id as string]));

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      order_id: r.order_id,
      order_code: codeById.get(r.order_id) ?? r.order_code ?? "",
      wa_id: r.wa_id ?? waIdByOrder.get(r.order_id) ?? "",
      kind: r.kind,
      status: r.status ?? "",
      payload: r.payload ?? {},
      created_at: r.created_at,
    })),
    next_cursor: String(rows[rows.length - 1].id),
  };
}
