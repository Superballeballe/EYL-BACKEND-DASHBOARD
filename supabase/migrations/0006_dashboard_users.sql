-- Dashboard operator accounts (separate from mobile app auth.users).

create table if not exists dashboard_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text,
  role          text not null default 'operator' check (role in ('admin', 'operator')),
  active        boolean not null default true,
  invited_by    uuid references dashboard_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
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

alter table dashboard_users enable row level security;
alter table dashboard_invites enable row level security;
