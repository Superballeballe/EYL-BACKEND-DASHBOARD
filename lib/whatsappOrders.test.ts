import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { checkApiKey, checkIntegrationKey } from "./auth";
import {
  normalizePhone10,
  phone10Schema,
  whatsappCustomerSchema,
  whatsappEventsQuerySchema,
  whatsappOrderCreateSchema,
  whatsappOrdersQuerySchema,
  whatsappQuoteSchema,
  type WhatsappOrderCreateInput,
} from "./schemas/whatsapp";
import {
  buildCreateBookingPayload,
  createWhatsappOrder,
  ensureCustomer,
  listWhatsappEvents,
  mapBookingError,
  mapPaymentLinkError,
  phone10FromWaId,
  toOrderView,
  WhatsappError,
  type Db,
} from "./server/whatsappOrders";

// ---- fixtures ----------------------------------------------------------------

const ORDER_ID = "6f1c2a1e-3b4d-4c5e-8f60-718293a4b5c6";
const USER_ID = "0a0b0c0d-1111-4222-8333-444455556666";

function stop(over: Record<string, unknown> = {}) {
  return {
    line: "Linking Road, Bandra West, Mumbai",
    lat: 19.06,
    lng: 72.83,
    contact_name: "Asha",
    contact_phone: "9876543210",
    ...over,
  };
}

function orderBody(over: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    wa_id: "919812345678",
    sender: { name: "Ravi" },
    pickup: stop({ line: "Andheri West, Mumbai", contact_name: "Ravi", contact_phone: "9812345678", floor: "4", apartment: "402" }),
    drops: [stop()],
    round_trip: false,
    item: { description: "Documents", category: "documents", weight_kg: 1, delicate_handling: false },
    tier: "standard",
    scheduled_for: "2026-10-20T11:00:00+05:30",
    slot_label: "11:00 AM – 2:00 PM",
    recipient_alerts_consent: true,
    ...over,
  };
}

function parseOrder(over: Record<string, unknown> = {}): WhatsappOrderCreateInput {
  return whatsappOrderCreateSchema.parse(orderBody(over));
}

// ---- a small Supabase fake ------------------------------------------------------

type Query = {
  table: string;
  action: "select" | "insert" | "upsert";
  columns?: string;
  row?: unknown;
  filters: [string, string, unknown][];
};
type Result = { data?: unknown; error?: { code?: string; message: string } | null };

function fakeDb(handlers: {
  query?: (q: Query) => Result;
  rpc?: (name: string, args: Record<string, unknown>) => Result;
  invoke?: (name: string, body: unknown) => Result | Promise<Result>;
  createUser?: (attrs: Record<string, unknown>) => Result;
  listUsers?: (opts: { page: number; perPage: number }) => Result;
}) {
  const calls = { queries: [] as Query[], rpc: [] as [string, Record<string, unknown>][], invoke: [] as [string, unknown][] };
  const resolve = (q: Query) => {
    calls.queries.push(q);
    const r = handlers.query?.(q) ?? {};
    return { data: r.data ?? null, error: r.error ?? null };
  };
  const builder = (table: string) => {
    const q: Query = { table, action: "select", filters: [] };
    const b: Record<string, unknown> = {
      select(columns: string) {
        q.columns = columns;
        return b;
      },
      insert(row: unknown) {
        q.action = "insert";
        q.row = row;
        return b;
      },
      upsert(row: unknown) {
        q.action = "upsert";
        q.row = row;
        return b;
      },
      eq(col: string, v: unknown) {
        q.filters.push(["eq", col, v]);
        return b;
      },
      in(col: string, v: unknown) {
        q.filters.push(["in", col, v]);
        return b;
      },
      gt(col: string, v: unknown) {
        q.filters.push(["gt", col, v]);
        return b;
      },
      order: () => b,
      limit: () => b,
      maybeSingle: () => Promise.resolve(resolve(q)),
      then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(resolve(q)).then(ok, bad),
    };
    return b;
  };
  const db = {
    from: builder,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.rpc.push([name, args]);
      const r = handlers.rpc?.(name, args) ?? {};
      return { data: r.data ?? null, error: r.error ?? null };
    },
    functions: {
      invoke: async (name: string, opts: { body: unknown }) => {
        calls.invoke.push([name, opts.body]);
        const r = (await handlers.invoke?.(name, opts.body)) ?? {};
        return { data: r.data ?? null, error: r.error ?? null };
      },
    },
    auth: {
      admin: {
        createUser: async (attrs: Record<string, unknown>) => {
          const r = handlers.createUser?.(attrs) ?? { data: { user: { id: USER_ID } } };
          return { data: r.data ?? { user: null }, error: r.error ?? null };
        },
        listUsers: async (opts: { page: number; perPage: number }) => {
          const r = handlers.listUsers?.(opts) ?? { data: { users: [] } };
          return { data: r.data ?? { users: [] }, error: r.error ?? null };
        },
      },
    },
  };
  return { db: db as unknown as Db, calls };
}

// ---- phones ----------------------------------------------------------------------

describe("phone normalisation", () => {
  it("takes the 10-digit mobile out of an Indian wa_id", () => {
    assert.equal(phone10FromWaId("919876543210"), "9876543210");
    assert.equal(phone10FromWaId("+919876543210"), "9876543210");
  });

  it("refuses other countries and non-mobile numbers", () => {
    assert.equal(phone10FromWaId("14155550123"), null);
    assert.equal(phone10FromWaId("915876543210"), null); // landline-style start digit
    assert.equal(phone10FromWaId("91987654321"), null);
    assert.equal(phone10FromWaId("9198765432101"), null);
  });

  it("accepts common Indian phone spellings for contacts", () => {
    assert.equal(normalizePhone10("+91 98765 43210"), "9876543210");
    assert.equal(normalizePhone10("09876543210"), "9876543210");
    assert.equal(normalizePhone10("919876543210"), "9876543210");
    assert.equal(phone10Schema.parse("98765-43210"), "9876543210");
    assert.equal(phone10Schema.safeParse("5876543210").success, false);
    assert.equal(phone10Schema.safeParse("98765").success, false);
    assert.equal(phone10Schema.safeParse(null).success, false);
  });
});

// ---- auth ------------------------------------------------------------------------

describe("checkIntegrationKey", () => {
  const saved = { key: process.env.WHATSAPP_INTEGRATION_KEY, api: process.env.API_KEY };
  beforeEach(() => {
    process.env.WHATSAPP_INTEGRATION_KEY = "wa-secret-123";
    process.env.API_KEY = "api-secret-456";
  });
  afterEach(() => {
    if (saved.key === undefined) delete process.env.WHATSAPP_INTEGRATION_KEY;
    else process.env.WHATSAPP_INTEGRATION_KEY = saved.key;
    if (saved.api === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = saved.api;
  });
  const req = (headers: Record<string, string>) => new Request("http://x/api/integrations/whatsapp/events", { headers });

  it("accepts only the integration key in x-integration-key", () => {
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "wa-secret-123" })), true);
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "wa-secret-124" })), false);
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "wa-secret-12" })), false);
    assert.equal(checkIntegrationKey(req({})), false);
  });

  it("never mixes up the integration key and API_KEY", () => {
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "api-secret-456" })), false);
    assert.equal(checkIntegrationKey(req({ "x-api-key": "wa-secret-123" })), false);
    assert.equal(checkApiKey(req({ "x-api-key": "wa-secret-123" })), false);
    assert.equal(checkApiKey(req({ "x-integration-key": "wa-secret-123" })), false);
  });

  it("is closed when WHATSAPP_INTEGRATION_KEY is unset or empty", () => {
    delete process.env.WHATSAPP_INTEGRATION_KEY;
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "" })), false);
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "anything" })), false);
    process.env.WHATSAPP_INTEGRATION_KEY = "";
    assert.equal(checkIntegrationKey(req({ "x-integration-key": "" })), false);
  });
});

// ---- validation ----------------------------------------------------------------------

describe("whatsapp schemas", () => {
  it("accepts a single-drop order and fills defaults", () => {
    const o = parseOrder();
    assert.equal(o.drops[0].is_return, false);
    assert.equal(o.drops[0].building, null);
    assert.equal(o.multi_drop_instructions, null);
    assert.equal(o.item.remarks, null);
  });

  it("accepts five drops plus a return stop on a round trip", () => {
    const drops = [1, 2, 3, 4, 5].map((n) => stop({ line: `Drop ${n}` }));
    const o = parseOrder({ round_trip: true, drops: [...drops, stop({ is_return: true })] });
    assert.equal(o.drops.length, 6);
  });

  it("refuses six real drops, no drops, and a lone return stop", () => {
    const six = [1, 2, 3, 4, 5, 6].map((n) => stop({ line: `Drop ${n}` }));
    assert.equal(whatsappOrderCreateSchema.safeParse(orderBody({ drops: six })).success, false);
    assert.equal(whatsappOrderCreateSchema.safeParse(orderBody({ drops: [] })).success, false);
    assert.equal(
      whatsappOrderCreateSchema.safeParse(orderBody({ round_trip: true, drops: [stop({ is_return: true })] })).success,
      false,
    );
  });

  it("only allows the return stop last, and only on a round trip", () => {
    const notLast = orderBody({ round_trip: true, drops: [stop({ is_return: true }), stop()] });
    assert.equal(whatsappOrderCreateSchema.safeParse(notLast).success, false);
    const oneWay = orderBody({ round_trip: false, drops: [stop(), stop({ is_return: true })] });
    assert.equal(whatsappOrderCreateSchema.safeParse(oneWay).success, false);
  });

  it("checks ids, times, tiers, phones and coordinates", () => {
    const bad = (over: Record<string, unknown>) => whatsappOrderCreateSchema.safeParse(orderBody(over)).success;
    assert.equal(bad({ id: "not-a-uuid" }), false);
    assert.equal(bad({ scheduled_for: "2026-10-20T11:00:00" }), false); // no offset
    assert.equal(bad({ scheduled_for: "2026-10-20T05:30:00Z" }), true);
    assert.equal(bad({ tier: "rocket" }), false);
    assert.equal(bad({ drops: [stop({ contact_phone: "12345" })] }), false);
    assert.equal(bad({ drops: [stop({ lat: 91 })] }), false);
    assert.equal(bad({ drops: [stop({ line: "  " })] }), false);
    assert.equal(bad({ item: { description: "x", delicate_handling: "yes" } }), false);
    assert.equal(bad({ wa_id: "+919812345678" }), true);
    assert.equal(bad({ wa_id: "98-12" }), false);
  });

  it("validates customers, quotes and query strings", () => {
    assert.deepEqual(whatsappCustomerSchema.parse({ wa_id: "919812345678", name: "  " }), {
      wa_id: "919812345678",
      name: null,
    });
    // Non-Indian wa_ids pass validation; they are refused later with 422 unsupported_country.
    assert.equal(whatsappCustomerSchema.safeParse({ wa_id: "14155550123" }).success, true);

    const quote = { pickup: { lat: 19.1, lng: 72.8 }, stops: [{ lat: 19.0, lng: 72.9 }], round_trip: false, delicate: true };
    assert.equal(whatsappQuoteSchema.safeParse(quote).success, true);
    assert.equal(whatsappQuoteSchema.safeParse({ ...quote, stops: [] }).success, false);
    assert.equal(
      whatsappQuoteSchema.safeParse({ ...quote, stops: [{ lat: 19, lng: 72.9, is_return: true }, { lat: 19, lng: 72.9 }], round_trip: true }).success,
      false,
    );

    assert.deepEqual(whatsappEventsQuerySchema.parse({}), { after: "0", limit: 100 });
    assert.deepEqual(whatsappEventsQuerySchema.parse({ after: "007", limit: "200" }), { after: "7", limit: 200 });
    assert.equal(whatsappEventsQuerySchema.safeParse({ after: "-1" }).success, false);
    assert.equal(whatsappEventsQuerySchema.safeParse({ after: "1e3" }).success, false);
    assert.equal(whatsappEventsQuerySchema.safeParse({ limit: "0" }).success, false);
    assert.equal(whatsappEventsQuerySchema.safeParse({ limit: "201" }).success, false);

    assert.deepEqual(whatsappOrdersQuerySchema.parse({ wa_id: "919812345678" }), { wa_id: "919812345678", limit: 5 });
    assert.equal(whatsappOrdersQuerySchema.safeParse({}).success, false);
  });
});

// ---- payload mapping ---------------------------------------------------------------------

describe("buildCreateBookingPayload", () => {
  const customer = { user_id: USER_ID, phone10: "9812345678" };

  it("maps a multi-drop round trip with the bot's return stop", () => {
    const input = parseOrder({
      round_trip: true,
      multi_drop_instructions: "Bring the signed copy back",
      drops: [
        stop({ contact_name: "Asha", contact_phone: "9876543210", building: "Sea View", instructions: "Ring twice" }),
        stop({ line: "Powai, Mumbai", lat: 19.12, lng: 72.9, contact_name: "Bina", contact_phone: "9123456780" }),
        stop({ line: "Andheri West, Mumbai", contact_name: "Ravi", contact_phone: "9812345678", is_return: true }),
      ],
    });
    const p = buildCreateBookingPayload(input, customer);

    assert.equal(p.id, ORDER_ID);
    assert.equal(p.user_id, USER_ID);
    // The first drop is the delivery and the recipient.
    assert.equal(p.recipient_name, "Asha");
    assert.equal(p.recipient_phone, "9876543210");
    assert.equal(p.delivery.contact_name, "Asha");
    assert.equal(p.delivery.building, "Sea View");
    assert.equal(p.delivery_instructions, "Ring twice");
    assert.equal(p.delivery_address, "Sea View, Linking Road, Bandra West, Mumbai");
    assert.equal(p.pickup.contact_phone, "9812345678");
    assert.equal(p.pickup_address, "Flat 402, 4th floor, Andheri West, Mumbai");

    // All stops in route order, the return last, in the app's camelCase shape.
    assert.deepEqual(
      p.invoice_metadata.stops.map((s) => [s.contactName, s.isReturn]),
      [["Asha", false], ["Bina", false], ["Ravi", true]],
    );
    assert.deepEqual(p.stops.map((s) => s.sort_order), [1, 2, 3]);
    assert.equal(p.stops[1].contactPhone, "9123456780");
    assert.equal(p.invoice_metadata.is_round_trip, true);
    assert.equal(p.invoice_metadata.channel, "whatsapp");
    assert.equal(p.invoice_metadata.return_instructions, "Bring the signed copy back");
    assert.equal(p.multi_drop_instructions, "Bring the signed copy back");
    assert.deepEqual(p.invoice_metadata.schedule, {
      slotId: null,
      label: "11:00 AM – 2:00 PM",
      scheduledFor: "2026-10-20T11:00:00+05:30",
    });
  });

  it("adds a return-to-pickup stop when a round trip has none", () => {
    const input = parseOrder({ round_trip: true, multi_drop_instructions: "Return the box" });
    const p = buildCreateBookingPayload(input, customer);
    assert.equal(p.invoice_metadata.stops.length, 2);
    const ret = p.invoice_metadata.stops[1];
    assert.equal(ret.isReturn, true);
    assert.equal(ret.line, "Andheri West, Mumbai");
    assert.equal(ret.contactName, "Ravi");
    assert.equal(ret.instructions, "Return the box");
    assert.equal(ret.lat, input.pickup.lat);
  });

  it("maps a one-way order without a return and leaves pricing to the server", () => {
    const p = buildCreateBookingPayload(parseOrder({ tier: "highspeed" }), customer);
    assert.equal(p.invoice_metadata.stops.length, 1);
    assert.equal(p.invoice_metadata.is_round_trip, false);
    assert.equal(p.invoice_metadata.return_instructions, null);
    assert.equal(p.delivery_tier, "highspeed");
    assert.equal(p.scheduled_for, "2026-10-20T11:00:00+05:30");
    assert.deepEqual(p.amounts, []);
    assert.equal(p.payment_status, "pending");
    assert.equal(p.invoice_type, "tax_invoice");
    assert.equal(p.tax.is_gst, true);
    assert.equal(p.tax.place_of_supply, "27");
    assert.deepEqual(p.user_snapshot, { name: "Ravi", phone: "9812345678", email: null });
    assert.deepEqual(p.item, {
      description: "Documents",
      category: "documents",
      weight_kg: 1,
      delicate_handling: false,
      remarks: "Pickup: 11:00 AM – 2:00 PM",
      images: [],
    });
  });
});

// ---- error mapping -------------------------------------------------------------------------

describe("mapBookingError", () => {
  const now = new Date("2026-10-16T10:00:00Z");
  const code = (message: string, errcode = "P0001", scheduledFor?: string) =>
    mapBookingError({ code: errcode, message }, { scheduledFor, now }).code;

  it("maps service-area guards", () => {
    assert.equal(code("pickup is outside the service area", "22023"), "outside_service_area");
    assert.equal(code("drop-off is outside the service area", "22023"), "outside_service_area");
    assert.equal(code("route is outside the service area", "22023"), "outside_service_area");
    assert.equal(code("no price band covers 61.2 km", "22023"), "outside_service_area");
    assert.equal(code("outside_service_area", "22023"), "outside_service_area");
  });

  it("splits the pickup-time guard into too soon / too far", () => {
    const msg = "pickup time not allowed: pick a slot at least 2 hours away";
    assert.equal(code(msg, "P0001", "2026-10-16T11:00:00Z"), "pickup_too_soon");
    assert.equal(code(msg, "P0001", "2026-11-20T11:00:00Z"), "pickup_too_far");
    assert.equal(code("pickup time not allowed: pick an upcoming slot"), "pickup_too_soon");
    assert.equal(code("pickup_too_far"), "pickup_too_far");
  });

  it("maps payment windows and payability", () => {
    assert.equal(code("payment window expired"), "deadline_passed");
    assert.equal(code("not allowed: confirmation window has closed"), "deadline_passed");
    assert.equal(code("payment is not pending"), "not_payable");
    assert.equal(code("Booking is not payable"), "not_payable");
  });

  it("keeps everything else out of the 422 codes", () => {
    assert.equal(mapBookingError({ code: "22023", message: "order has no drop-off" }).status, 400);
    assert.equal(mapBookingError({ code: "23505", message: "duplicate key" }).status, 409);
    const other = mapBookingError({ code: "42501", message: "permission denied" });
    assert.equal(other.status, 500);
    assert.equal(other.code, undefined);
  });
});

describe("mapPaymentLinkError", () => {
  it("maps edge-function codes", () => {
    assert.equal(mapPaymentLinkError(409, { error: "x", code: "not_payable" }).code, "not_payable");
    assert.equal(mapPaymentLinkError(409, { error: "x", code: "already_paid" }).code, "not_payable");
    assert.equal(mapPaymentLinkError(409, { error: "x", code: "payment_window_closed" }).code, "deadline_passed");
    assert.equal(mapPaymentLinkError(422, { error: "x", code: "deadline_passed" }).status, 422);
  });

  it("falls back on status", () => {
    assert.equal(mapPaymentLinkError(409, { error: "Booking is not payable" }).code, "not_payable");
    assert.equal(mapPaymentLinkError(409, { error: "Something odd" }).code, "not_payable");
    assert.equal(mapPaymentLinkError(404, { error: "Order not found" }).status, 404);
    const e = mapPaymentLinkError(500, null);
    assert.equal(e.status, 500);
    assert.equal(e.message, "Couldn't create the payment link.");
  });
});

// ---- customers -------------------------------------------------------------------------------

describe("ensureCustomer", () => {
  it("creates a phone-confirmed auth user and links it", async () => {
    let created: Record<string, unknown> | null = null;
    const { db, calls } = fakeDb({
      createUser: (attrs) => {
        created = attrs;
        return { data: { user: { id: USER_ID } } };
      },
    });
    const c = await ensureCustomer(db, "919812345678", " Ravi ");
    assert.deepEqual(c, { user_id: USER_ID, created: true, phone10: "9812345678", name: "Ravi" });
    assert.deepEqual(created, {
      phone: "919812345678",
      phone_confirm: true,
      user_metadata: { name: "Ravi", phone: "9812345678", source: "whatsapp" },
    });
    const upsert = calls.queries.find((q) => q.action === "upsert");
    assert.deepEqual(upsert?.row, { wa_id: "919812345678", user_id: USER_ID, phone10: "9812345678", name: "Ravi" });
  });

  it("reuses the auth user that already has the phone", async () => {
    const pages: number[] = [];
    const filler = Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, phone: `9170000${String(i).padStart(5, "0")}` }));
    const { db } = fakeDb({
      createUser: () => ({ error: { message: "A user with this phone number has already been registered" } }),
      listUsers: ({ page }) => {
        pages.push(page);
        return { data: { users: page === 1 ? filler : [{ id: USER_ID, phone: "919812345678" }] } };
      },
    });
    const c = await ensureCustomer(db, "919812345678");
    assert.equal(c.user_id, USER_ID);
    assert.equal(c.created, false);
    assert.deepEqual(pages, [1, 2]);
  });

  it("returns the linked user without touching auth", async () => {
    const { db } = fakeDb({
      query: (q) => (q.table === "whatsapp_customers" && q.action === "select" ? { data: { user_id: USER_ID, name: "Ravi" } } : {}),
      createUser: () => {
        throw new Error("should not create");
      },
    });
    assert.deepEqual(await ensureCustomer(db, "919812345678"), {
      user_id: USER_ID,
      created: false,
      phone10: "9812345678",
      name: "Ravi",
    });
  });

  it("refuses non-Indian numbers with unsupported_country", async () => {
    const { db } = fakeDb({});
    await assert.rejects(ensureCustomer(db, "14155550123"), (e: unknown) => {
      assert.ok(e instanceof WhatsappError);
      assert.equal(e.status, 422);
      assert.equal(e.code, "unsupported_country");
      return true;
    });
  });
});

// ---- order creation ---------------------------------------------------------------------------

describe("createWhatsappOrder", () => {
  const booking = {
    id: ORDER_ID,
    order_code: "APPEYL123456",
    status: "placed",
    total_amount: 177,
    invoice_number: "INV-APPEYL123456",
    payment_deadline_at: "2026-10-16T10:30:00Z",
    confirm_deadline_at: "2026-10-20T04:30:00Z",
  };
  const link = { payment_url: "https://rzp.io/i/abc", payment_link_id: "plink_1", expires_at: null, total: 177 };

  it("books, links and returns the payment link", async () => {
    const { db, calls } = fakeDb({
      rpc: () => ({ data: booking }),
      invoke: () => ({ data: link }),
    });
    const { replay, order } = await createWhatsappOrder(db, parseOrder());
    assert.equal(replay, false);
    assert.deepEqual(order, {
      order_id: ORDER_ID,
      order_code: "APPEYL123456",
      status: "placed",
      total: 177,
      invoice_number: "INV-APPEYL123456",
      payment_url: "https://rzp.io/i/abc",
      payment_link_id: "plink_1",
      payment_deadline_at: "2026-10-16T10:30:00Z",
    });
    assert.equal(calls.rpc[0][0], "create_booking_as");
    assert.equal(calls.rpc[0][1].p_user_id, USER_ID);
    assert.deepEqual(calls.invoke, [["razorpay-payment-link", { order_id: ORDER_ID, action: "create" }]]);
    const insert = calls.queries.find((q) => q.table === "whatsapp_order_links" && q.action === "insert");
    assert.deepEqual(insert?.row, { order_id: ORDER_ID, wa_id: "919812345678", recipient_alerts_consent: true });
  });

  it("treats a repeat id as a replay and ignores the duplicate link", async () => {
    const { db } = fakeDb({
      query: (q) => {
        if (q.table === "whatsapp_order_links" && q.action === "select") return { data: { wa_id: "919812345678" } };
        if (q.table === "orders") return { data: { id: ORDER_ID, user_id: USER_ID } };
        if (q.table === "whatsapp_order_links" && q.action === "insert") return { error: { code: "23505", message: "dup" } };
        return {};
      },
      rpc: () => ({ data: booking }),
      invoke: () => ({ data: link }),
    });
    const { replay } = await createWhatsappOrder(db, parseOrder());
    assert.equal(replay, true);
  });

  it("refuses an id linked to another WhatsApp number", async () => {
    const { db } = fakeDb({
      query: (q) => (q.table === "whatsapp_order_links" && q.action === "select" ? { data: { wa_id: "919999999999" } } : {}),
    });
    await assert.rejects(createWhatsappOrder(db, parseOrder()), (e: unknown) => e instanceof WhatsappError && e.status === 409);
  });

  it("retries an order-code clash, then maps booking guards", async () => {
    let n = 0;
    const { db, calls } = fakeDb({
      rpc: () => (++n === 1 ? { error: { code: "23505", message: "orders_order_code_key" } } : { error: { code: "22023", message: "drop-off is outside the service area" } }),
    });
    await assert.rejects(createWhatsappOrder(db, parseOrder()), (e: unknown) => {
      assert.ok(e instanceof WhatsappError);
      assert.equal(e.code, "outside_service_area");
      return true;
    });
    assert.equal(calls.rpc.length, 2);
    assert.equal(calls.invoke.length, 0);
  });

  it("surfaces payment-link refusals as 422 codes", async () => {
    const { db } = fakeDb({
      rpc: () => ({ data: booking }),
      invoke: () => ({
        error: new FunctionsHttpError(
          new Response(JSON.stringify({ error: "The 30-minute payment window has closed", code: "payment_window_closed" }), {
            status: 409,
          }),
        ) as unknown as { message: string },
      }),
    });
    await assert.rejects(createWhatsappOrder(db, parseOrder()), (e: unknown) => {
      assert.ok(e instanceof WhatsappError);
      assert.equal(e.status, 422);
      assert.equal(e.code, "deadline_passed");
      return true;
    });
  });
});

// ---- reads ----------------------------------------------------------------------------------

describe("toOrderView", () => {
  it("lists real drops only and normalises payment status", () => {
    const v = toOrderView({
      id: ORDER_ID,
      order_code: "APPEYL123456",
      status: "assigned",
      rider_name: " Karan ",
      scheduled_for: "2026-10-20T05:30:00Z",
      pickup: { line: "Andheri West", apartment: "402" },
      pickup_address: "fallback",
      delivery_address: "Bandra",
      total_price: 100,
      payment_deadline_at: null,
      confirm_deadline_at: "2026-10-20T04:30:00Z",
      invoices: [
        {
          payment_status: "paid",
          total_amount: 177,
          metadata: { stops: [{ line: "Bandra" }, { line: "Powai", floor: "2" }, { line: "Andheri West", isReturn: true }] },
        },
      ],
    });
    assert.equal(v.pickup_line, "Flat 402, Andheri West");
    assert.deepEqual(v.drop_lines, ["Bandra", "2nd floor, Powai"]);
    assert.equal(v.payment_status, "paid");
    assert.equal(v.total, 177);
    assert.equal(v.knight_name, "Karan");
    assert.equal(v.tracking_url, null);
  });

  it("falls back to the delivery row and pending", () => {
    const v = toOrderView({ id: ORDER_ID, order_code: "C", status: "placed", delivery_address: "Bandra", total_price: 90, invoices: null });
    assert.deepEqual(v.drop_lines, ["Bandra"]);
    assert.equal(v.payment_status, "pending");
    assert.equal(v.total, 90);
    assert.equal(v.knight_name, null);
  });
});

describe("listWhatsappEvents", () => {
  it("joins order codes and advances the cursor", async () => {
    const { db, calls } = fakeDb({
      query: (q) => {
        if (q.table === "integration_order_events") {
          return {
            data: [
              { id: 41, order_id: ORDER_ID, wa_id: "919812345678", kind: "confirmed", status: "confirmed", payload: {}, created_at: "t1" },
              { id: 42, order_id: ORDER_ID, wa_id: "919812345678", kind: "assigned", status: "assigned", payload: { knight_name: "K" }, created_at: "t2" },
            ],
          };
        }
        if (q.table === "orders") return { data: [{ id: ORDER_ID, order_code: "APPEYL123456" }] };
        return {};
      },
    });
    const res = await listWhatsappEvents(db, "40", 100);
    assert.equal(res.next_cursor, "42");
    assert.deepEqual(res.data.map((e) => [e.id, e.order_code, e.kind]), [["41", "APPEYL123456", "confirmed"], ["42", "APPEYL123456", "assigned"]]);
    assert.deepEqual(calls.queries[0].filters, [["gt", "id", "40"]]);
    assert.equal(calls.queries.some((q) => q.table === "whatsapp_order_links"), false);
  });

  it("keeps the input cursor when there is nothing new", async () => {
    const { db } = fakeDb({});
    assert.deepEqual(await listWhatsappEvents(db, "42", 100), { data: [], next_cursor: "42" });
  });
});
