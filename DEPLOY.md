# Deploying the EYL Dashboard

A hardened Docker Compose setup for self-hosting the Next.js dashboard.

## What's in the box

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build → Next.js standalone server, runs as non-root `nextjs`, with a `HEALTHCHECK`. |
| `docker-compose.yml` | Runs the app hardened (read-only FS, dropped caps, resource limits, log rotation). Optional `proxy` profile adds Caddy. |
| `deploy/Caddyfile` | Reverse proxy: automatic HTTPS + security headers. |
| `.env.local` | **Secrets** (gitignored). Required to run. |

## 1. Prerequisites

- Docker Engine + Compose v2 (`docker compose version`)
- A filled-in `.env.local` (copy from `.env.local.example`):

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (**build arg** — needed at image build) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret**, server-only. Rotate before going live. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (**build arg**) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JS key (**build arg**; enable Maps JS / Places / Directions / Geocoding; allow your prod domain in key referrers) |
| `SESSION_SECRET` | Random 32+ byte string (`openssl rand -hex 32`) |
| `API_KEY` | Secret for `x-api-key` write endpoints |
| `DASHBOARD_DOMAIN` | (proxy only) real hostname for Let's Encrypt TLS |

> The DB schema must already be applied (`supabase/migrations/0001_init.sql`).
>
> Always pass `--env-file .env.local` so Compose can resolve `${NEXT_PUBLIC_*}`
> build args. Runtime still loads the full file via `env_file`. Changing a
> `NEXT_PUBLIC_*` value requires a rebuild (`--build`).

## 2. Run — app only (behind your own LB/proxy)

```bash
docker compose --env-file .env.local up -d --build
curl http://127.0.0.1:3000/api/health        # {"ok":true,...}
docker compose ps                              # STATUS should show "healthy"
```

The app binds to `127.0.0.1:3000` only — not exposed to the network. Put it
behind your existing reverse proxy / load balancer, or use the proxy profile.

## 3. Run — with Caddy (auto-HTTPS)

Set a real domain (DNS A/AAAA record → this host) in `.env.local`:

```bash
echo 'DASHBOARD_DOMAIN=dashboard.example.com' >> .env.local
docker compose --env-file .env.local --profile proxy up -d --build
```

Caddy provisions and renews a Let's Encrypt certificate automatically and
serves on 80/443. Without a domain it falls back to `localhost` with a local
self-signed cert (good for testing the proxy path).

## 4. Operate

```bash
docker compose --env-file .env.local logs -f dashboard
docker compose --env-file .env.local restart dashboard
docker compose --env-file .env.local up -d --build   # rebuild / update
docker compose --env-file .env.local down
```

## Hardening applied

- **Non-root** runtime user (`nextjs`), `no-new-privileges`, **all Linux capabilities dropped**.
- **Read-only root filesystem**; only `/tmp` and `/app/.next/cache` are writable (tmpfs, in-memory).
- **Resource limits** (1 CPU / 512 MB) so a single container can't starve the host.
- **Log rotation** (10 MB × 3 files) to bound disk usage.
- **Health-gated**: Caddy waits for the app to report healthy before routing.
- **Security headers** both at the app (`next.config.mjs`) and the edge (Caddy), plus HSTS over TLS.
- Secrets via `env_file` at runtime; `NEXT_PUBLIC_*` also passed as **build args** so the client bundle gets Maps/Supabase public config. `.dockerignore` keeps `.env*` out of the build context.

## Before this is truly production-ready

This setup hardens the *container/deploy* layer. Still outstanding (see the repo
assessment): rotate the Supabase service-role key and DB password, replace the
single shared `APP_PASSWORD` with real per-user auth, add CI/CD + tests +
error tracking, and wire up a DB migration pipeline. The mobile app
(`EYL-APP-2`) is a separate deploy (Expo/EAS), and the two are not yet
integrated at the data layer.
