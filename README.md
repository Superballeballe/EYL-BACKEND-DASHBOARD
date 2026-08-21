# EYL Delivery — Dashboard, Database & API

Replaces the hand-maintained "Line Up" Excel workbook with a real database
(Supabase / Postgres), a web app for data entry, and a JSON API you can wire to
other apps / automate.

**Modules:** Deliveries · Daily Lineup · Knights + monthly Salaries · Clients
(billing/GST) · Rate Cards (km-based pricing).

Stack: Next.js 15 (App Router, TypeScript) · Tailwind CSS · Supabase
(service-role, server-side only) · React Hook Form + Zod · SheetJS (importer).

---

## 1. Prerequisites

- Node.js 20+ (tested on 22/25) and npm
- A Supabase project (free tier is fine)

## 2. Configure environment

Edit `.env.local` (already created; **fill in the service-role key**):

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** service-role key — server only, never shipped to the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key (optional for now) |
| `SESSION_SECRET` | Random string used to sign the login cookie |
| `API_KEY` | Secret for the `x-api-key` header on automation endpoints |
| `RESEND_API_KEY` / `INVITE_FROM_EMAIL` | Dashboard verification and invitation email |
| `APP_URL` | Public dashboard URL used in email links |

## 3. Create the database schema

Open your Supabase project → **SQL Editor** → paste the contents of
`supabase/migrations/0001_init.sql` → **Run**. (Or, with the Supabase CLI linked:
`supabase db push`.) This creates all tables, indexes, and enables RLS — access
is only via the service-role key the server holds.

## 4. Install & run

```bash
npm install
npm run dev        # http://localhost:3000  (use /setup for the first admin)
```

Production / self-host:

```bash
npm run build
npm start          # serves the standalone build
```

## 5. Import the existing Excel data

Imports knights + monthly salaries (`Sheet3`), clients (`Billind Details`), rate
cards, and the daily sheets (lineup + deliveries). Columns are matched **by
header name** (the Jan and May layouts differ), and each delivery's task date is
anchored to the **sheet's own date** rather than the error-prone cell.

```bash
# Validate parsing without writing anything:
npm run import -- --file="/path/to/Line Up - 1st Jan to 31st Dec 2026.xlsx" --month=2026-05 --dry-run

# Import May 2026:
npm run import -- --file="/path/to/Line Up ... .xlsx" --month=2026-05

# Backfill another month later (re-runs are idempotent):
npm run import -- --file="/path/to/Line Up ... .xlsx" --month=2026-04

# Everything:
npm run import -- --file="/path/to/Line Up ... .xlsx"
```

Notes:
- Re-running is safe: deliveries upsert on `(src_sheet, src_row)`; knights/clients
  are added only when missing; a day's lineup is replaced wholesale.
- Rows whose times Excel mangled into dates (e.g. `4 11` → a date) are recovered
  best-effort and flagged `needs_review = true` (find them on the dashboard or
  `/deliveries?needs_review=true`) — never dropped.

---

## API and workflow documentation

The system spans this dashboard, the consumer EYL app, the EYL Knight app, and
one shared Supabase project. Start with [`docs/api/README.md`](docs/api/README.md).

- [`dashboard-http-api.md`](docs/api/dashboard-http-api.md) — every dashboard HTTP and SSE route
- [`supabase-api.md`](docs/api/supabase-api.md) — Auth, PostgREST, RPCs, Edge Functions, Storage, and Realtime
- [`access-control.md`](docs/api/access-control.md) — who can see and change each resource
- [`order-lifecycle.md`](docs/api/order-lifecycle.md) — booking, payment, assignment, fulfilment, cancellation, and refund flows
- [`production-drift.md`](docs/api/production-drift.md) — verified differences between source and the live database
- [`openapi/`](docs/api/openapi/) — machine-readable dashboard and Edge Function contracts

Dashboard APIs accept a signed `eyl_session` cookie or `x-api-key`, except
public auth and health routes. Admin operations additionally require an admin
dashboard session. Mobile apps use Supabase Auth and are constrained by RLS and
guarded RPCs. Never expose the dashboard API key or Supabase service-role key
to either mobile app.

---

## Self-hosting with Docker

```bash
docker build -t eyl-dashboard .
docker run -p 3000:3000 --env-file .env.local eyl-dashboard
```

The image uses Next.js standalone output and runs `node server.js`, executes as a
non-root user, and ships a `HEALTHCHECK` against `/api/health`.

### Hardened deploy (Docker Compose)

For self-hosting, a hardened `docker-compose.yml` is included:

```bash
docker compose --env-file .env.local up -d --build                  # app only, on 127.0.0.1:3000
docker compose --env-file .env.local --profile proxy up -d --build  # app + Caddy (auto-HTTPS) on 80/443
```

`--env-file .env.local` is required so `NEXT_PUBLIC_*` (Maps, Supabase) are available at image build time.
Applied hardening:

- **Non-root** runtime user, `no-new-privileges`, **all Linux capabilities dropped**
- **Read-only root filesystem** (only `/tmp` and `/app/.next/cache` are writable tmpfs)
- **Resource limits** (1 CPU / 512 MB) and **log rotation** (10 MB × 3)
- Container **healthcheck** wired into Compose; Caddy waits for healthy before routing
- **Security headers** at the app (`next.config.mjs`) and edge (`deploy/Caddyfile`), plus HSTS over TLS
- Secrets passed via `env_file` with `format: raw` so values containing `$` aren't mangled by Compose interpolation
- App bound to loopback unless the `proxy` profile (Caddy, automatic Let's Encrypt TLS) is enabled

See [`DEPLOY.md`](DEPLOY.md) for the full runbook and the remaining
production-readiness gaps (secrets rotation, real auth, etc.).

---

## Project layout

```
app/(app)/...        web pages (dashboard, deliveries, lineup, knights, salaries, clients, rates)
app/api/...          JSON API route handlers
app/login            per-user dashboard login
components/          forms + UI
docs/api/            cross-system API, permissions, and workflow reference
lib/parse/           date/time/knight/header normalizers (shared by API + importer)
lib/schemas/         Zod validation (shared by forms + API)
lib/supabase/        service-role client
supabase/migrations/ SQL schema
scripts/import-excel.ts   the workbook importer
middleware.ts        auth gate
```

## Data model (high level)

`knights` ← `knight_salaries` (monthly) · `work_days` ← `daily_assignments`
(per-knight lineup) · `clients` (billing/GST) · `rate_tiers` (km pricing) ·
`deliveries` (the core table, with billing + invoice fields and `needs_review`
/ `src_sheet` provenance).
