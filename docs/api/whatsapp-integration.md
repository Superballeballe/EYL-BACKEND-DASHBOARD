# WhatsApp bot integration

**Repository-defined.** These routes let the WhatsApp bot book EYL deliveries for WhatsApp customers. They implement v1 of the integration contract (`docs/eyl-integration-contract.md` in the whatsapp-bot repo). If this page and the contract disagree, the contract wins.

Base URL: `/api/integrations/whatsapp`. Every route is `runtime = "nodejs"` and uses the service-role client.

## Auth

- Header: `x-integration-key: $WHATSAPP_INTEGRATION_KEY`. [`checkIntegrationKey`](../../lib/auth.ts) compares it in constant time.
- The key is **separate from `API_KEY`**. `API_KEY` unlocks every dashboard route, including admin and refunds, so the bot never gets it. In the other direction, the integration key opens nothing except this prefix.
- [`middleware.ts`](../../middleware.ts) lists the prefix in `PUBLIC_PREFIXES`, so a request reaches the route without a session. Every handler therefore checks the key first and returns `401` without it. A session cookie or `x-api-key` does **not** work here.
- If `WHATSAPP_INTEGRATION_KEY` is unset or empty, every request gets `401`, so the integration is off.

## Errors

Errors use the `lib/api.ts` shape `{ error, details?, code? }`:

| Status | When |
|---|---|
| 400 | Invalid JSON, a body or query that fails zod validation ([`lib/schemas/whatsapp.ts`](../../lib/schemas/whatsapp.ts)), or a malformed id |
| 401 | Missing or wrong integration key |
| 404 | The order doesn't exist or wasn't placed through WhatsApp |
| 409 | The order `id` is already used by another customer or wa_id |
| 422 | A business rule refused the request; see `code` below |
| 500 | Server, database or edge-function failure |

`code` values for 422 come from database guard messages and edge-function codes ([`mapBookingError` / `mapPaymentLinkError`](../../lib/server/whatsappOrders.ts)):

| `code` | Source |
|---|---|
| `unsupported_country` | `wa_id` isn't `91` followed by a 10-digit Indian mobile number |
| `outside_service_area` | `reprice_order` (`pickup/drop-off/route is outside the service area`), `eyl_distance_fare` (`no price band covers … km`), or `quote_booking` (`outside_service_area`); all 22023 |
| `pickup_too_soon` | `guard_client_pickup_time`: `pickup time not allowed: …` with a slot less than 1.5 h away |
| `pickup_too_far` | The same guard with the slot more than about 29 days away (the guard has one message for both limits) |
| `deadline_passed` | Payment window expired or confirmation window closed (`payment_window_closed`, `slot_too_soon`, `deadline_passed` from the edge function) |
| `not_payable` | The booking can't take payment (`not_payable`, `not_pending`, `already_paid`, or any other 409/422 from the edge function) |

## Routes

| Method and path | Behaviour |
|---|---|
| `POST /customers` | `{wa_id, name?}` → `{user_id, created, phone10, name}`. Uses the `whatsapp_customers` row if one exists. Otherwise calls `auth.admin.createUser({phone: "91XXXXXXXXXX", phone_confirm: true, user_metadata: {name, phone, source: "whatsapp"}})`. If the phone is already registered, it reuses that auth user (looked up with `auth.admin.listUsers` paging), then upserts `whatsapp_customers`. |
| `POST /quote` | `{pickup, stops[1..6], round_trip, delicate}` → `quote_booking(p)` → `{km, fare, handling_fee, taxable, cgst, sgst, total, currency: "INR"}`. The validated body is passed through as `p`. |
| `POST /orders` | Resolves the customer → `create_booking_as(p_user_id, p_payload)` → inserts `whatsapp_order_links` (a duplicate is ignored) → invokes `razorpay-payment-link {order_id, action: "create"}`. Returns `201`, or `200` on a replay of the same `id`. |
| `GET /orders?wa_id=&limit=` | Up to `limit` (1–20, default 5) linked orders, newest first: `{data: OrderView[]}`. |
| `GET /orders/:id` | One `OrderView`. Orders without a `whatsapp_order_links` row return `404`. |
| `POST /orders/:id/payment-link` | Linked orders only. Invokes `razorpay-payment-link` (`create`), which returns the active link or issues a new one after checking payability again → `{payment_url, payment_link_id, expires_at, total}`. |
| `GET /events?after=&limit=` | `integration_order_events` with `id > after` (default `0`), in id order, `limit` 1–200 (default 100), joined with `orders.order_code`. `next_cursor` is the last returned id, or `after` if no events are returned. |

`OrderView`: `{order_id, order_code, status, payment_status, total, knight_name, scheduled_for, pickup_line, drop_lines, payment_deadline_at, confirm_deadline_at, tracking_url}`.

- `knight_name` comes from `orders.rider_name`.
- `drop_lines` are the stops in `invoices.metadata.stops` that aren't return stops, each formatted with `composeAddressLine`.
- `tracking_url` is always `null`, because there is no public tracking page yet.

## create_booking payload

[`buildCreateBookingPayload`](../../lib/server/whatsappOrders.ts) builds the same jsonb the consumer app sends (EYL-APP `src/services/bookingService.js` `buildBookingRpcPayload`):

- **Pickup, delivery and recipient:**
  - `pickup` and `delivery` are `{line, company, building, floor, apartment, lat, lng, contact_name, contact_phone}`. The delivery is the first real drop.
  - `recipient_name` and `recipient_phone` come from the first drop.
  - `pickup_address` and `delivery_address` are built with `composeAddressLine`.
- **Stops:**
  - `stops` and `invoice_metadata.stops` use the app's camelCase shape: `{line, …, contactName, contactPhone, instructions, isReturn}`.
  - They list every drop in order. On a round trip, the return stop comes last. If the bot didn't send one, it's built from the pickup and gets `multi_drop_instructions`, as the app's `buildRoundTripReturnDrop` does.
- **Invoice metadata:** `invoice_metadata` also holds `channel: "whatsapp"`, `is_round_trip`, `schedule {slotId: null, label, scheduledFor}`, `multi_drop_instructions` and `return_instructions`.
- **Item:** `item.remarks` joins the item remarks with `Pickup: <slot_label>`, and `item.images` is `[]`.
- **Prices:** `amounts` is empty and the tax figures are zero. Because `create_booking_as` sets the customer's identity, the `reprice_client_invoice` trigger then prices the order on the server. The response's `total` is the re-priced `invoices.total_amount`.

## Database objects (EYL-APP)

These objects are created by EYL-APP migrations, not by this repo:

- the tables `whatsapp_customers`, `whatsapp_order_links(order_id, wa_id, recipient_alerts_consent)` and `integration_order_events`;
- the RPCs `create_booking_as` and `quote_booking`;
- the edge function `razorpay-payment-link`.

The routes return `500` until these objects exist in the target project.
