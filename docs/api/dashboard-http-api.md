# Dashboard HTTP API

**Repository-defined.** Source inventory of every route under [`app/api`](../../app/api). JSON success responses generally use the shape shown below; validation failures are `400`, missing rows `404`, authorization failures `401/403`, and unexpected failures `500`.

## Authentication

[`middleware.ts`](../../middleware.ts) allows public auth/health paths through. Every other `/api` path requires either:

1. a valid signed dashboard session cookie, or
2. `x-api-key: $API_KEY`.

The route then runs with the server-only [service-role client](../../lib/supabase/admin.ts), which bypasses RLS. A route marked **session** performs an additional full user lookup (active and email-verified); an API key alone cannot pass it. **Admin** additionally requires `dashboard_users.role = admin`. The two SSE routes validate a signed cookie payload directly. Public auth routes and health are the only middleware exceptions.

## Public auth and health

| Method and path | Request | Response and side effects |
|---|---|---|
| `GET /api/health` | None | `{ok, service, supabaseConfigured, time}`; no DB probe. [Source](../../app/api/health/route.ts) |
| `GET /api/auth/setup` | None | `{setupRequired}` from dashboard-user count. [Source](../../app/api/auth/setup/route.ts) |
| `POST /api/auth/setup` | JSON `{email, password(>=8), name?}` | Creates the first verified admin only and sets the signed cookie. |
| `POST /api/auth/signup` | JSON `{email, password(>=8), name?}` | Creates/reuses an unverified dashboard user, stores a 24-hour verification token and emails it. First user is admin; later users are operators. [Source](../../app/api/auth/signup/route.ts) |
| `POST /api/auth/login` | JSON `{email, password}` | Returns `{ok,user}` and sets the cookie; rejects inactive/unverified users. [Source](../../app/api/auth/login/route.ts) |
| `GET /api/auth/accept-invite?token=...` | Invite token | `{valid,email?,role?,expired?}`. [Source](../../app/api/auth/accept-invite/route.ts) |
| `POST /api/auth/accept-invite` | JSON `{token, password(>=8), name?}` | Creates a verified invited user, consumes invite, sets cookie. |
| `GET /api/auth/verify-email?token=...` | Verification token | `{valid,expired?}`. [Source](../../app/api/auth/verify-email/route.ts) |
| `POST /api/auth/verify-email` | JSON `{token}` | Marks email verified, consumes token, sets cookie. |
| `POST /api/auth/resend-verification` | JSON `{email}` | Replaces the token and emails a new 24-hour link when applicable; always returns a non-enumerating success message. [Source](../../app/api/auth/resend-verification/route.ts) |

## Session and administration

| Auth | Method and path | Request | Response and side effects |
|---|---|---|---|
| Cookie/API key | `POST /api/auth/logout` | None | Clears the dashboard cookie. The handler itself does not require a full session. [Source](../../app/api/auth/logout/route.ts) |
| Session | `GET /api/auth/me` | None | `{id,email,name,role}`. [Source](../../app/api/auth/me/route.ts) |
| Session | `POST /api/auth/change-password` | JSON `{currentPassword,newPassword(>=8)}` | Verifies current password and replaces its hash. [Source](../../app/api/auth/change-password/route.ts) |
| Admin | `GET /api/admin/users` | None | `{users,invites}`. [Source](../../app/api/admin/users/route.ts) |
| Admin | `POST /api/admin/users` | JSON `{email,role?: admin\|operator}` | Stores a seven-day invite, sends email, returns invite metadata, URL and email status. |
| Admin | `DELETE /api/admin/users/:id` | Path user UUID | Deletes a user; refuses self-delete and removal of the last active admin. [Source](../../app/api/admin/users/[id]/route.ts) |
| Admin | `DELETE /api/admin/invites/:id` | Path invite UUID | Deletes an unexpired, unused invite. [Source](../../app/api/admin/invites/[id]/route.ts) |

## Deliveries, lifecycle and pricing

Delivery payload fields are defined in [`lib/schemas/index.ts`](../../lib/schemas/index.ts): dates/mode/serial, sender and pickup/drop details, coordinates and time windows, knight assignment, fulfillment, fees/distance/payment/invoice/client, content/remarks and review flag. Create validation requires booking/task date, mode, serial, sender, pickup/drop and actual times, recipient/phone, status, knight unless cancelled, working hours unless cancelled, fees, km, payment status/mode and final amount. Patch accepts any subset.

| Auth | Method and path | Request/query | Response and side effects |
|---|---|---|---|
| Cookie/API key | `GET /api/deliveries` | `limit<=500`, `offset`, `date`, `from`, `to`, `knight_id`, `payment_status`, `client_id`, `needs_review=true`, `q` | `{data,count,limit,offset}`; `q` searches names, locations, content and invoice. [Source](../../app/api/deliveries/route.ts) |
| Cookie/API key | `POST /api/deliveries` | Delivery JSON | Creates a **manual dashboard delivery only**; resolves knight and generates a missing invoice number. `serial_no` must pass validation. It does not create an `orders` row and never enters the knight pool. |
| Cookie/API key | `GET /api/deliveries/:id` | Path UUID | Delivery row or `404`. [Source](../../app/api/deliveries/[id]/route.ts) |
| Cookie/API key | `PATCH /api/deliveries/:id` | Partial delivery JSON | Updates delivery and resolves knight fields. |
| Admin | `DELETE /api/deliveries/:id` | Path UUID | Calls `delete_delivery`; a linked app order may also be deleted. Idempotent for a missing delivery. |
| Cookie/API key | `PATCH /api/deliveries/:id/lifecycle` | One of `{action:"confirm"}`, `{action:"assign",knight_id?,knight_name?,pickup_scheduled_at?,delivery_scheduled_at?}`, `{action:"pickup"}`, `{action:"deliver"}`, `{action:"cancel"}` | Updates delivery and linked app order, validates ordering/schedules and sends best-effort push notifications. App-order cancellation creates refund state; manual cancellation only marks delivery cancelled. [Source](../../app/api/deliveries/[id]/lifecycle/route.ts) |
| Cookie/API key | `GET /api/deliveries/next-serial?mode=online\|b2b` | Optional mode; default `online` | Next serial metadata. [Source](../../app/api/deliveries/next-serial/route.ts) |
| Cookie/API key | `GET /api/deliveries/next-invoice` | None | Next invoice metadata. [Source](../../app/api/deliveries/next-invoice/route.ts) |
| Cookie/API key | `GET /api/pricing/quote` | `km` or `distanceKm`; flags `isCake`, `isFood`, `delicateHandling`/`isFragile`, `keepUpright`, `isLiquid`, `temperatureSensitive` | `{data,seed}` computed from current tiers, surcharges and pricing config. [Source](../../app/api/pricing/quote/route.ts) |
| Cookie/API key | `POST /api/pricing/quote` | JSON `{orderId}` | Loads app-order walker mode/fare and linked delivery km; returns final quote. No write. |
| Cookie/API key | `POST /api/import` | JSON `{deliveries:[...]}` (1–1000) | Validates each row with the delivery schema, inserts valid rows, returns `{inserted,failed,errors}`. Despite its comment saying API-key-only, middleware also admits a cookie session. [Source](../../app/api/import/route.ts) |

### Lifecycle cancellation

For a linked paid app order, dashboard cancellation hardcodes a rounded 10% fee, creates `cancelled_orders` with a pending refund for the remainder, marks `orders` and `deliveries` cancelled, decrements the assigned knight's `orders_today`, and records refund metadata on the invoice. Cancellation is blocked after pickup. See [order lifecycle](order-lifecycle.md).

## Ops data

Body field definitions are in [`lib/schemas/index.ts`](../../lib/schemas/index.ts). Unless noted, item routes return the row and collection routes return `{data}`.

| Auth | Method and path | Request/query | Response and side effects |
|---|---|---|---|
| Cookie/API key | `GET /api/clients` | `q` over client/company/GST | Client list. [Source](../../app/api/clients/route.ts) |
| Cookie/API key | `POST /api/clients` | `{client_name,company_name?,address?,gst_no?,phone?,note?}` | Creates client (`201`). |
| Cookie/API key | `GET/PATCH/DELETE /api/clients/:id` | Patch: any client fields | Read, update or delete client. [Source](../../app/api/clients/[id]/route.ts) |
| Cookie/API key | `GET /api/knights` | `active=true`, `role` | Roster list. [Source](../../app/api/knights/route.ts) |
| Cookie/API key | `POST /api/knights` | `{full_name,display_name,role?,joining_date?,default_location?,active?,note?}` | Creates roster knight and invalidates cache. |
| Cookie/API key | `GET/PATCH/DELETE /api/knights/:id` | Patch: any roster fields | Read (including salaries), update or delete; writes invalidate roster cache. [Source](../../app/api/knights/[id]/route.ts) |
| Cookie/API key | `GET /api/eyl-knights/:id` | Path UUID | Knight-app applicant. [Source](../../app/api/eyl-knights/[id]/route.ts) |
| Cookie/API key | `PATCH /api/eyl-knights/:id` | `{status?,review_note?,knight_id?,knight_role?}` | Approve/reject/edit applicant. Approval creates a roster knight when needed. |
| Cookie/API key | `DELETE /api/eyl-knights/:id` | Path UUID | Removes applicant and best-effort deletes stored documents. |
| Cookie/API key | `GET /api/rates` | `provider`, `current=true` | Rate tiers. [Source](../../app/api/rates/route.ts) |
| Cookie/API key | `POST /api/rates` | `{provider,label?,min_km?,max_km?,fee?,fee_ex_gst?,gst_amount?,effective_from?,is_current?,note?}` | Creates tier (`201`). |
| Cookie/API key | `PATCH/DELETE /api/rates/:id` | Patch: any rate fields | Updates or deletes tier. [Source](../../app/api/rates/[id]/route.ts) |
| Cookie/API key | `GET /api/coupons` | `year_month`, `active=true` | Coupons. [Source](../../app/api/coupons/route.ts) |
| Cookie/API key | `POST /api/coupons` | `{year_month,code,type:percent\|flat,value,label,active?}` | Creates uppercase code (`201`). |
| Cookie/API key | `PATCH/DELETE /api/coupons/:id` | Patch: any coupon fields | Update; delete first removes redemption rows. [Source](../../app/api/coupons/[id]/route.ts) |
| Cookie/API key | `GET /api/salaries` | `knight_id`, `month` | Salaries with knight. [Source](../../app/api/salaries/route.ts) |
| Cookie/API key | `POST /api/salaries` | `{knight_id,month:YYYY-MM,travel,salary,total?}` | Upserts by knight/month; derives total when omitted (`201`). |
| Cookie/API key | `GET /api/lineup` | Required `date=YYYY-MM-DD` | `{work_day,assignments}`. [Source](../../app/api/lineup/route.ts) |
| Cookie/API key | `POST /api/lineup` | `{work_date,is_sunday?,note?,assignments:[{knight_id?,knight_name?,role?,location?,shift_time?,status?,note?,position?}]}` | Upserts work day, then replaces that day's assignments wholesale. |

## Refunds

| Auth | Method and path | Request | Response and side effects |
|---|---|---|---|
| Session | `POST /api/cancelled-orders/:id/refund` | Path cancellation UUID | Processes one refund, idempotently returns `{ok,refund_id,amount,already}`. [Source](../../app/api/cancelled-orders/[id]/refund/route.ts) |
| Session or API key | `POST /api/refunds/process-pending?limit=1..100` | Default limit `20` | Processes oldest pending refunds; source is `manual` for session or `cron` for API key. Returns counts and per-item results. [Source](../../app/api/refunds/process-pending/route.ts) |

Manual, automatic and cron processing all append `refund_events` with success/failure/skipped outcome. Successful processing updates `cancelled_orders` and invoice metadata. See [`lib/server/processRefund.ts`](../../lib/server/processRefund.ts).

## Non-JSON endpoints

| Auth | Method and path | Protocol |
|---|---|---|
| Signed cookie payload | `GET /api/deliveries/stream` | SSE bridge for `deliveries`, `orders` and `invoices`. Emits `ready`, `change`, and 30-second `ping`; payloads do not contain rows. [Source](../../app/api/deliveries/stream/route.ts) |
| Signed cookie payload | `GET /api/refunds/stream` | SSE watcher for `cancelled_orders`; runs the refund queue immediately and after changes, emitting `ready`, `change`, `processed`, `error`, and `ping`. Opening this stream has payment side effects. [Source](../../app/api/refunds/stream/route.ts) |
| Cookie/API key | `GET /api/invoices/:id/html?download=1` | Returns rendered `text/html`, inline by default or attachment when `download=1`; `404` is plain text. [Source](../../app/api/invoices/[id]/html/route.ts) |
