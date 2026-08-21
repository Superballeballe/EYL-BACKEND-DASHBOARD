# Access control

There are two independent security systems:

1. **Dashboard HTTP auth:** signed dashboard cookie and role checks, with `x-api-key` automation access.
2. **Supabase auth:** anon-key clients become `authenticated` through a Supabase user JWT; table privileges, RLS and RPC code enforce access.

The dashboard's [service-role client](../../lib/supabase/admin.ts) bypasses RLS. Never expose it to a browser/mobile bundle.

## Dashboard matrix

**Repository-defined.** “Base API” means middleware accepts either cookie or `x-api-key`.

| Resource/action | Public | API key | Operator session | Admin session |
|---|---:|---:|---:|---:|
| Health; setup/login/signup/invite acceptance/email verification | Yes | Yes | Yes | Yes |
| Read/create/update ops resources (deliveries, clients, roster, rates, coupons, salaries, lineup, pricing, import) | No | Yes | Yes | Yes |
| Delivery lifecycle actions | No | Yes | Yes | Yes |
| Delete clients/roster/rates/coupons | No | Yes | Yes | Yes |
| Delete delivery | No | **No** | No | Yes |
| Read/start SSE streams | No | **No** | Yes | Yes |
| Process one refund | No | **No** | Yes | Yes |
| Process pending refunds | No | Yes (cron source) | Yes (manual source) | Yes |
| Read current user/change password | No | **No** | Yes | Yes |
| List/invite/delete dashboard users or invites | No | **No** | No | Yes |
| Render invoice HTML | No | Yes | Yes | Yes |

An API key gets broad operator-equivalent access because middleware is the only check on most routes. It cannot satisfy `requireSessionUser` or `requireAdmin`; in particular it cannot satisfy admin routes. SSE also explicitly requires the cookie payload.

## Supabase role/resource/action matrix

This summarizes intended access plus live exceptions. “Own” always means evaluated by DB policy using `auth.uid()`, not a client parameter.

| Resource/action | Anon/no session | Consumer JWT | Approved/pending knight JWT | Dashboard service role |
|---|---:|---:|---:|---:|
| Supabase Auth signup/login/OAuth/anonymous flows | Auth endpoints only | Self | Self | Not used |
| `profiles` select/update | No | Own | Own; knight profiles may be readable for order display | All |
| `addresses` CRUD | No | Own | Not an intended knight feature | All |
| `orders` read | No | Own non-cancelled rows | Open pool + own pending/assigned rows | All |
| `orders` create | No | Via `create_booking` | No intended create | All |
| `orders` update | No | Narrow RPC flows intended | Assigned row direct update | All |
| `order_items`, `order_amounts` read | No | Through owned order | Through visible order where policy permits | All |
| `invoices` read | No | Owned order | Open/own-job metadata where policy permits | All |
| `cancelled_orders` read | No | **Live verified: own rows** | No intended access | All |
| `monthly_coupons` read | Policy-defined public/auth read | Active rows | Not used | All |
| `coupon_redemptions` read | No | Own | No | All |
| `app_push_tokens` CRUD | No | Own | Not currently used by knight app | All |
| `eyl_knights` select/insert/update | No | Only if same authenticated user uses knight flow | Own application row | All |
| `order-photos` storage | Policy-defined | Own-prefix upload/public URL | No | All |
| `knight-documents` storage | No | No intended use | Own-prefix insert/select/update | All |
| Realtime rows | No useful private rows | Rows passing SELECT RLS | Rows passing SELECT RLS | All published rows |

## RPC action matrix

| Action | Consumer | Knight | Dashboard |
|---|---:|---:|---:|
| Create/edit/cancel own booking | Intended | No | Direct service-role lifecycle |
| Pay/restore own draft | Intended | No | No normal caller |
| Claim open order (`knight_confirm_pickup`) | No | Intended; role checked in function | Direct lifecycle alternative |
| Set walker transport | No | Assigned knight only in function | Reads it for pricing |
| Sweep stale drafts/payment windows | Client invokes opportunistically | Not intended | Can invoke as service role |
| Destructive purge/delete helpers | **Live grant exists; not intended** | **Live grant exists; not intended** | Used for delivery deletion |

## UI gating is not authorization

- Consumer screens hide other users' orders, admin helpers and knight actions, but a modified client can call PostgREST/RPC directly.
- Knight navigation checks profile role and application approval before showing work screens. Those checks do not protect rows.
- Dashboard pages may hide admin controls, but only route-level `requireAdmin()` protects the corresponding HTTP action.
- Realtime filters reduce client traffic; they are not permissions. Supabase emits only rows the subscriber can `SELECT`.

Therefore every new mobile write needs a restrictive RLS `WITH CHECK` or a narrowly validated RPC. Every privileged dashboard action needs a route-level session/role check, not just middleware or a hidden button.

## Live verified security gaps (2026-08-19)

These are current risks, not completed fixes:

- `authenticated` can execute `delete_delivery`, `expire_unpaid_assigned_order`, `purge_app_order`, `sweep_expired_drafts`, and `sweep_unpaid_assigned_orders`.
- `orders_knight_update` is broad: assignment ownership permits more columns/status changes than the intended knight workflow.
- `eyl_knights_self_update` is broad. Knight profile/onboarding save upserts status and can overwrite/demote an ops approval.
- Pending-knight invoice metadata visibility is incomplete.
- Draft repayment trusts a weaker server payment-verification path than normal Razorpay verification.
- Live open-pool policies depend on DB-only helpers `order_has_pending_invoice` and `order_is_knight_open_pool`; repository migrations do not define them.
- The deployed `razorpay-refund` function requires JWT, but repository config says otherwise; see [production drift](production-drift.md).

Repository policy references: [schema baseline](../../../EYL-APP/supabase_schema.sql), [open pool migration](../../../EYL-APP/supabase/migrations/20260819140000_knight_open_orders_visibility.sql), [invoice visibility migration](../../../EYL-APP/supabase/migrations/20260819150000_invoices_knight_open_read.sql), and [knight onboarding migration](../../supabase/migrations/0014_eyl_knights.sql).
