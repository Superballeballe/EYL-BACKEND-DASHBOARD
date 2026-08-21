# API and operations reference

This directory documents the dashboard HTTP API and the shared Supabase surface used by the consumer and knight apps.

- [Dashboard HTTP API](dashboard-http-api.md)
- [Supabase API](supabase-api.md)
- [Access control](access-control.md)
- [Order lifecycle](order-lifecycle.md)
- [Production drift](production-drift.md)
- [Dashboard OpenAPI](openapi/dashboard.openapi.yaml)
- [Supabase Edge Functions OpenAPI](openapi/supabase-functions.openapi.yaml)
- [Read-only live verification queries](live-verification.sql)

## Evidence labels

- **Live verified** — observed in the production database or deployed function configuration on 2026-08-19.
- **Repository-defined** — behavior found in current source or timestamped migrations; it may not match production.
- **Drift** — a known difference between production and repository artifacts.

When sources disagree, use this order: **live database and deployed function configuration > timestamped migrations > schema baseline > snippets and `APPLY`/historical artifacts**. Do not infer that a migration has run merely because it exists.

The dashboard API runs server-side with the Supabase service-role key and therefore bypasses RLS. Both mobile apps use the Supabase anon key; once signed in, their database permissions come from the user JWT plus RLS/RPC checks. See [access control](access-control.md) before adding a client call.

The root README is a short index. This directory is the authoritative repository documentation for API and workflow details.
