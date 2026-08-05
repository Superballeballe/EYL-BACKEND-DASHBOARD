-- Email verification for self-service sign up.

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

alter table dashboard_email_verifications enable row level security;

-- Existing accounts (setup / invites) stay usable.
update dashboard_users set email_verified_at = now() where email_verified_at is null;
