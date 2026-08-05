-- Run this once in Supabase SQL Editor (Dashboard → SQL → New query).
-- Creates dashboard auth tables + email verification.
-- Safe to re-run (uses IF NOT EXISTS / IF NOT EXISTS column).

-- ---------------------------------------------------------------------------
-- 1. Users & invites
-- ---------------------------------------------------------------------------

create table if not exists dashboard_users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  password_hash     text not null,
  name              text,
  role              text not null default 'operator' check (role in ('admin', 'operator')),
  active            boolean not null default true,
  invited_by        uuid references dashboard_users(id) on delete set null,
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);

create index if not exists dashboard_users_email_lower_idx on dashboard_users (lower(email));

create table if not exists dashboard_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        text not null default 'operator' check (role in ('admin', 'operator')),
  token       text not null unique,
  invited_by  uuid not null references dashboard_users(id) on delete cascade,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists dashboard_invites_token_idx on dashboard_invites (token) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Email verification (sign-up confirmation)
-- ---------------------------------------------------------------------------

alter table dashboard_users
  add column if not exists email_verified_at timestamptz;

create table if not exists dashboard_email_verifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references dashboard_users(id) on delete cascade,
  token      text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_email_verifications_token_idx
  on dashboard_email_verifications (token);

-- ---------------------------------------------------------------------------
-- 3. RLS (service role bypasses; no anon policies)
-- ---------------------------------------------------------------------------

alter table dashboard_users enable row level security;
alter table dashboard_invites enable row level security;
alter table dashboard_email_verifications enable row level security;

-- Mark any pre-existing rows as verified (none on fresh install).
update dashboard_users set email_verified_at = now() where email_verified_at is null;

-- ---------------------------------------------------------------------------
-- 4. One account per email (case-insensitive)
-- ---------------------------------------------------------------------------

delete from dashboard_users
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by lower(email)
        order by (role = 'admin') desc, created_at asc, id asc
      ) as rn
    from dashboard_users
  ) ranked
  where rn > 1
);

create unique index if not exists dashboard_users_email_lower_unique
  on dashboard_users (lower(email));
