# Production drift register

**Last live verification: 2026-08-19.**

This is an observation register, not a remediation log. Every item marked risk/drift below was present at verification time; nothing in this documentation implies it has been fixed.

## Source precedence

When sources conflict:

1. **Live verified:** production database definitions/grants/policies/publications and deployed Edge Function configuration.
2. **Repository-defined:** timestamped migrations, evaluated in actual application order.
3. Schema baseline such as [`EYL-APP/supabase_schema.sql`](../../../EYL-APP/supabase_schema.sql).
4. Snippets, duplicated ` 2.sql` files, `APPLY` files and other historical/manual artifacts.

Repository files are deployment intent or history, not proof of production state. Before changing a function or policy, capture its live definition and grants; several names are repeatedly replaced across migrations.

## Live database versus repository

| Area | Live verified | Repository-defined / drift |
|---|---|---|
| Open knight pool | Role `knight`; no assigned/pending knight; status `placed/registered/accepted/confirmed`; pending invoice. Policies use `order_has_pending_invoice` and `order_is_knight_open_pool`. | Latest visible migration in the consumer repo uses inline predicates. The two live helper functions are absent from repository migrations. |
| `sync_order_to_delivery` | Dashboard `0018` lineage: invoice-aware payment, coordinates/km and walker transport fare/mode. | Consumer migrations also redefine this function, including later status/schedule variants. Redeploy order can overwrite live behavior. |
| `prepare_knight_assignment` | Consumer migration lineage; assignment starts/reopens a three-minute payment window. | This can differ from the dashboard route's “pay before assignment” assumptions. |
| `finalize_order_on_invoice_paid` | Dashboard `0020` lineage: promotes pending knight and syncs delivery payment/mode. | Consumer migrations contain an earlier variant without the full dashboard payment synchronization. |
| Unpaid expiry | Three-minute deadlines are swept opportunistically; rows can remain expired while the consumer is closed. | App invokes the sweep while reading orders; there is no evidence here of an independent scheduled sweep. |
| Draft repayment | Places order and starts a six-hour delivery window. | Repository RPC accepts provider/payment references in caller payload; this is weaker than the normal Razorpay verification path. |
| Status vocabulary | Live data/logic spans `placed`, `registered`, `accepted`, `confirmed`, `assigned`, `rider_assigned`, `picked_up`, `in_transit`, `delivered`, `cancelled`, `draft`; delivery has a separate vocabulary. | Migrations contain legacy aliases and mappings (`pending`, `canceled`, `booked`, `active`, `completed`). Updating one map can regress another trigger/client. |
| Manual deliveries | Dashboard-created rows remain only in `deliveries` and never appear in the knight pool. | Only app-created `orders` use `orders -> deliveries` synchronization. Do not expect symmetry. |
| `cancelled_orders` read | `authenticated` has `SELECT`; own-row policy exists. | The table-creation migration first revokes authenticated access; a later migration restores own-row reads. Partial deploys can produce either state. |

## Edge Function configuration drift

**Live verified:** deployed `razorpay-refund` has `verify_jwt=true`.

**Drift:** [`EYL-APP/supabase/config.toml`](../../../EYL-APP/supabase/config.toml) declares:

```toml
[functions.razorpay-refund]
verify_jwt = false
```

A config-driven redeploy can disable the current JWT gateway check. The function body itself processes refund inputs and does not independently authenticate a dashboard caller. Re-verify deployed configuration after every function deployment.

## Realtime drift

**Live verified publication members:**

- `cancelled_orders`
- `deliveries`
- `eyl_knights`
- `invoices`
- `orders`

`refund_events` is not published. Only `deliveries` had replica identity `FULL`; all other listed tables had `DEFAULT` in the live probe.

Repository migrations add publication members incrementally and some older baselines mention different members (for example `profiles`). Do not rebuild publication membership from one migration without comparing live state. `DEFAULT` replica identity can limit old-row content/filtering for update/delete events.

## Unresolved live security risks

The following were live on 2026-08-19:

1. `authenticated` can execute destructive or broad maintenance RPCs:
   - `delete_delivery`
   - `expire_unpaid_assigned_order`
   - `purge_app_order`
   - `sweep_expired_drafts`
   - `sweep_unpaid_assigned_orders`
2. `orders_knight_update` allows assigned knights a broader update surface than the intended status-only workflow.
3. `eyl_knights_self_update` permits broad self updates. Knight profile/onboarding save upserts application status and can overwrite or demote an ops approval.
4. Invoice metadata needed by a pending knight has a visibility gap.
5. Draft repayment has weaker server-side payment verification than the standard `razorpay-verify` flow.
6. Function/policy/status definitions are spread across competing migration lineages, creating redeploy risk.
7. The local `razorpay-refund` JWT setting disagrees with production.

These are security defects or operational hazards, not supported features. The [access-control matrix](access-control.md) records intended access separately.

## Deployment verification checklist

After any database/function deployment, verify rather than infer:

- live function bodies for `sync_order_to_delivery`, `prepare_knight_assignment`, `finalize_order_on_invoice_paid`, claim/payment/expiry and cancellation RPCs;
- `proacl`/effective execute privileges on all `SECURITY DEFINER` functions;
- table grants plus policy predicates for `orders`, `invoices`, `eyl_knights`, and `cancelled_orders`;
- open-pool behavior for an actual knight JWT, including pending-invoice metadata;
- `razorpay-refund` deployed `verify_jwt`;
- Realtime publication membership and replica identity;
- create, claim, three-minute expiry, draft repayment, pickup/delivery, cancellation and refund flows;
- dashboard API key versus session/admin route behavior.

Relevant repository evidence: [dashboard `0018`](../../supabase/migrations/0018_walker_transport_from_knight.sql), [dashboard `0020`](../../supabase/migrations/0020_payment_status_from_invoice.sql), [consumer claim migration](../../../EYL-APP/supabase/migrations/20260819140000_knight_open_orders_visibility.sql), [consumer invoice visibility](../../../EYL-APP/supabase/migrations/20260819150000_invoices_knight_open_read.sql), and [consumer draft repayment](../../../EYL-APP/supabase/migrations/20260818140000_confirm_draft_starts_6h_delivery.sql).
