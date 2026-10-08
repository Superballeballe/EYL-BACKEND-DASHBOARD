# Supabase API used by mobile apps

The consumer and knight apps both create Supabase clients with the **anon key** and persisted PKCE sessions ([consumer](../../../EYL-APP/src/lib/supabase.js), [knight](../../../EYL-KNIGHT-APP/src/lib/supabase.js)). They do not have service-role access. `authenticated` table privileges, RLS policies and `SECURITY DEFINER` RPC checks are the security boundary; UI role checks are not.

## Auth

**Repository-defined.**

- **Consumer:** email/password signup and login; custom email OTP functions; Google OAuth; anonymous sign-in; session exchange/set/refresh; profile update; email, phone and password changes; sign-out; authenticated account deletion. [Source](../../../EYL-APP/src/services/authService.js)
- **Knight:** email/password signup/login/sign-out, email-confirmation check, and profile role/name/phone updates. Signup metadata sets `role=knight` and `knight_role=walker|biker`. [Source](../../../EYL-KNIGHT-APP/src/services/authService.js)
- Both apps persist refresh/access tokens in `AsyncStorage`. The knight app explicitly applies the access token to Realtime.

## Consumer database surface

**Repository-defined from current callers.**

| Resource | Consumer operations | Enforcement/notes |
|---|---|---|
| `profiles` | Select/update own profile | Expected self RLS. Client-supplied `userId` is not an authorization boundary. |
| `addresses` | Select/insert/update/delete saved addresses | Queries scope by `user_id`; owner RLS is the real boundary. Guests use device storage. |
| `orders` | Select own list/detail; direct status/update helpers remain in source | Main creation/edit/cancel flow uses RPCs. Nested reads include items, amounts and invoices. |
| `order_items`, `order_amounts` | Nested reads through `orders` | Created atomically by `create_booking`. |
| `invoices` | Select own non-draft invoice records | Ownership is derived through the related order. |
| `cancelled_orders` | Select own cancellation/refund rows | **Live verified:** `authenticated` has `SELECT` and `cancelled_orders_select_own` limits rows to `user_id=auth.uid()`. |
| `monthly_coupons` | Select active coupon metadata | Read policy; validation/discount calculation is performed by Edge Function. |
| `coupon_redemptions` | Select own redemption markers | Used for display; insert is trigger/function controlled. |
| `hub_contacts` | Select active "Call the Hub" contacts (`id,label,description,phone,sort_order`) | Column grant + `hub_contacts_read_active`; writes are admin-only (`get_my_role()='admin'`), at most 10 active rows (trigger). Managed from the dashboard's Hub contacts page. |
| `app_push_tokens` | Upsert own Expo token | User-scoped policies. |

Sources: [booking service](../../../EYL-APP/src/services/bookingService.js), [address service](../../../EYL-APP/src/services/savedAddressService.js), [coupon service](../../../EYL-APP/src/services/couponService.js), [notification service](../../../EYL-APP/src/services/notificationService.js).

## Knight database surface

**Repository-defined callers; live policy details are called out explicitly.**

| Resource | Knight operations | Enforcement/notes |
|---|---|---|
| `profiles` | Select/update own profile; registration writes role/name/phone | **Live risk:** role/profile update policy is broader than the UI assumes. |
| `eyl_knights` | Upsert own onboarding/application; select approval; update during profile save | Intended self-row RLS by `user_id`. **Live risk:** broad self-update lets a later profile save overwrite approval fields or demote status. |
| `orders` | Read open pool, held jobs and own assigned jobs; update assigned order status | **Live verified open pool:** role is `knight`, both knight IDs null, status in `placed/registered/accepted/confirmed`, and invoice pending. Live policy delegates to DB-only helpers `order_has_pending_invoice` and `order_is_knight_open_pool`, which are absent from repository migrations. |
| `invoices` | Nested metadata on open/held/assigned orders | **Live risk:** pending-knight invoice metadata has a visibility gap. |

The knight writes operational statuses directly to `orders`: `picked_up`, then `in_transit`, then `delivered` (with `delivered_at`). It uses RPCs for claiming and walker transport. [Source](../../../EYL-KNIGHT-APP/src/services/authService.js)

## RPCs called by apps

| RPC | Caller and inputs | Result/side effects |
|---|---|---|
| `create_booking(p_payload)` | Consumer; complete order document | Atomically creates order, item, amounts and pending invoice. New app-style non-draft orders sync into `deliveries`. |
| `confirm_draft_payment(p_order_id,p_payload)` | Consumer | Marks draft placed and invoice paid; sets pickup now/default and a six-hour delivery deadline. **Live risk:** weaker server-side payment verification than the normal Razorpay verification path. |
| `sweep_expired_drafts()` | Consumer on draft listing | Opportunistically removes/expires stale drafts. |
| `sweep_unpaid_assigned_orders()` | Consumer on order reads | Opportunistically reverts expired unpaid assignment/payment windows. If the app is closed, expired rows can linger. |
| `cancel_customer_order(p_order_id,p_reason_code,p_reason_note)` | Consumer | Cancels before pickup, records `cancelled_orders`, applies 10% fee to paid orders and marks refund pending. |
| `update_unconfirmed_order(p_order_id,p_payload)` | Consumer | Rewrites editable unconfirmed order data. |
| `update_confirmed_drop(p_order_id,p_drop)` | Consumer | Changes destination for eligible confirmed order and updates cancellation/price consequences defined by DB. |
| `set_return_instructions(p_order_id,p_instructions)` | Consumer | Stores round-trip return instructions. |
| `knight_confirm_pickup(p_order_id)` | Knight | Holds the open order as `pending_knight_id` and starts/restarts a three-minute payment window. |
| `set_walker_transport(p_order_id,p_mode,p_cab_fare_inr)` | Assigned knight | Stores `cab` or `public_transit`; syncs fare/mode to dashboard delivery. |

Call sites: [consumer booking](../../../EYL-APP/src/services/bookingService.js) and [knight orders](../../../EYL-KNIGHT-APP/src/services/authService.js).

**Live verified exposure not required by those intended flows:** `authenticated` can also execute `delete_delivery`, `expire_unpaid_assigned_order`, `purge_app_order`, `sweep_expired_drafts`, and `sweep_unpaid_assigned_orders`. Treat these grants as security defects, not supported client APIs.

## Edge Functions

Functions live under [`EYL-APP/supabase/functions`](../../../EYL-APP/supabase/functions). Deployed `verify_jwt` is authoritative over local config.

| Function | JWT / caller | Request and purpose |
|---|---|---|
| `razorpay-order` | JWT; consumer | `{amount,receipt,gst?,bookingOrderId?}`; validates user-owned order/invoice where linked and creates a Razorpay order (or free result). |
| `razorpay-verify` | JWT; consumer | Razorpay order/payment/signature plus `bookingOrderId?`; verifies signature and marks invoice paid. |
| `razorpay-refund` | **Live verified: `verify_jwt=true`**; dashboard server invokes it | `{payment_id,amount_paise,idempotency_key,notes}`; creates/idempotently recognizes Razorpay refund. **Drift:** local [`config.toml`](../../../EYL-APP/supabase/config.toml) says `false`, so redeploy can regress authentication. |
| `validate-coupon` | JWT; consumer | `{code,subtotal}`; validates current active, unused coupon and returns discount. |
| `geocode` | JWT; consumer | `{query,bias?}`; authenticated Google geocoding proxy. |
| `verify-gstin` | JWT; consumer | `{gstin,requireActive}`; authenticated GST verification proxy. |
| `delete-account` | JWT; consumer | Deletes signed-in consumer data and auth account. |
| `realtime-token` | JWT; consumer voice | Issues short-lived OpenAI Realtime credentials and records usage session. |
| `send-signup-code` | Public by repository config | `{email,purpose}`; stores hashed OTP and sends signup/change code. |
| `verify-otp-code` | Invoked publicly by consumer | `{email,token,purpose}`; validates OTP and may return signup session credentials. |
| `send-account-notice` | Public by repository config | Sends account-change notices. |
| `send-auth-email` | Public by repository config | Auth email delivery helper; no current direct app caller found. |
| `whatsapp-webhook` | Public webhook | WhatsApp verification/inbound webhook; not called by either mobile client. |

## Storage

| Bucket | Client | Behavior |
|---|---|---|
| `order-photos` | Consumer | Uploads `${userId}/${timestamp}-${index}.${ext}` and reads a public URL. Upload failures are tolerated and return no photo. [Source](../../../EYL-APP/src/services/bookingService.js) |
| `knight-documents` | Knight | Private, 5 MiB image documents under `${auth.uid()}/...`; own-folder insert/select/update policies, one-hour signed URLs. Dashboard service role can read/delete during review. [Migration](../../supabase/migrations/0014_eyl_knights.sql) |

## Realtime

**Live verified:** publication tables are `cancelled_orders`, `deliveries`, `eyl_knights`, `invoices`, and `orders`. `refund_events` is not published. Only `deliveries` has replica identity `FULL`; the others were `DEFAULT` in the live probe.

- Consumer subscribes to own `orders` inserts/updates and coalesces events for notifications/UI refresh. [Source](../../../EYL-APP/src/hooks/useOrderNotifications.js)
- Knight subscribes to open/all order inserts/updates, assigned/pending filtered updates, and own `eyl_knights` approval updates. RLS still determines delivered rows. [Source](../../../EYL-KNIGHT-APP/src/hooks/useKnightRealtime.js)
- Dashboard uses server-side Realtime as an SSE bridge; see [HTTP API](dashboard-http-api.md#non-json-endpoints).

Replica identity `DEFAULT` may limit old-row data and update/delete filtering. Publication membership does not grant table access; RLS remains separate.
