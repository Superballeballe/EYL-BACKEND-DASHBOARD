-- ============================================================================
-- EYL Delivery — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- All access goes through the Next.js server using the service-role key,
-- which bypasses RLS. RLS is enabled with no public policies so the anon /
-- authenticated roles cannot read or write directly.
-- ============================================================================

create extension if not exists pgcrypto;

-- Keep updated_at fresh on every UPDATE.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- knights : delivery staff master (walkers & bikers)
-- ---------------------------------------------------------------------------
create table if not exists knights (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  display_name     text not null,                 -- short name used in sheets, e.g. "Vilas"
  role             text check (role in ('walker','biker')),
  joining_date     date,
  default_location text,
  active           boolean not null default true,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists knights_display_name_key on knights (lower(display_name));
create trigger knights_set_updated_at before update on knights
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- knight_salaries : monthly salary history (from Sheet3 column-blocks)
-- ---------------------------------------------------------------------------
create table if not exists knight_salaries (
  id          uuid primary key default gen_random_uuid(),
  knight_id   uuid not null references knights(id) on delete cascade,
  month       date not null,                      -- first day of the month
  travel      numeric(12,2) default 0,
  salary      numeric(12,2) default 0,
  total       numeric(12,2),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (knight_id, month)
);
create index if not exists knight_salaries_month_idx on knight_salaries (month);
create trigger knight_salaries_set_updated_at before update on knight_salaries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- work_days : one row per operating day (the daily sheet header)
-- ---------------------------------------------------------------------------
create table if not exists work_days (
  work_date     date primary key,
  is_sunday     boolean not null default false,
  note          text,                             -- e.g. "Karim On leave / Vilas On Half day"
  walker_count  integer,
  biker_count   integer,
  src_sheet     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger work_days_set_updated_at before update on work_days
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- daily_assignments : who works each day (walkers/bikers, location, shift)
-- ---------------------------------------------------------------------------
create table if not exists daily_assignments (
  id          uuid primary key default gen_random_uuid(),
  work_date   date not null references work_days(work_date) on delete cascade,
  knight_id   uuid references knights(id) on delete set null,
  knight_name text,                               -- raw name from the sheet
  role        text check (role in ('walker','biker')),
  location    text,
  shift_time  text,                               -- free text, e.g. "10AM - 08PM", "Any time"
  status      text not null default 'working' check (status in ('working','leave','half_day')),
  note        text,
  position    integer,                            -- row order within the day
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists daily_assignments_work_date_idx on daily_assignments (work_date);
create index if not exists daily_assignments_knight_idx on daily_assignments (knight_id);
create trigger daily_assignments_set_updated_at before update on daily_assignments
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- clients : billing / GST master (from "Billind Details")
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  client_name  text not null,
  company_name text,
  address      text,
  gst_no       text,
  phone        text,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists clients_name_key on clients (lower(client_name));
create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- rate_tiers : km-based rate cards (EYL + Fudpro + 3rd-party providers)
-- ---------------------------------------------------------------------------
create table if not exists rate_tiers (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,                   -- eyl | eyl_cake | fudpro | wefast | uber | porter
  label          text,                            -- e.g. "0 kms - 3 kms"
  min_km         numeric(8,2),
  max_km         numeric(8,2),
  fee            numeric(12,2),                    -- customer-facing fee (incl GST for EYL)
  fee_ex_gst     numeric(12,2),
  gst_amount     numeric(12,2),
  effective_from date,
  is_current     boolean not null default true,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists rate_tiers_provider_idx on rate_tiers (provider, is_current);
create trigger rate_tiers_set_updated_at before update on rate_tiers
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- deliveries : the core booking table (modeled on the May/current layout)
-- ---------------------------------------------------------------------------
create table if not exists deliveries (
  id                   uuid primary key default gen_random_uuid(),

  -- when
  serial_no            integer,
  booking_date         date,
  task_date            date,
  mode_of_booking      text check (mode_of_booking in ('b2b','online')),

  -- sender (the business / person booking)
  sender_name          text,
  sender_last_name     text,

  -- pickup
  pickup_location      text,
  pickup_time_window   text,
  pickup_actual_time   text,

  -- drop
  drop_location        text,
  drop_recipient_name  text,
  drop_time_window     text,
  drop_actual_time     text,

  -- assignment
  knight_id            uuid references knights(id) on delete set null,
  knight_name          text,                       -- raw; may be combo / external provider / "CANCELLED"
  assignment_status    text not null default 'assigned' check (assignment_status in ('assigned','cancelled')),

  -- money
  fees                 numeric(12,2),
  kms                  numeric(8,2),
  working_hours        text,
  cod_remark           text,
  cab_auto_fare        text,
  payment_status       text check (payment_status in ('paid','unpaid','free','partial')),
  final_bill_amount    numeric(12,2),
  payment_mode         text,
  payment_received_date date,

  -- billing
  billing_name         text,
  billing_address      text,
  gst_no               text,
  invoice_no           text,
  invoice_date         date,
  client_id            uuid references clients(id) on delete set null,

  -- misc
  content              text,
  remark               text,

  -- provenance / data quality
  src_sheet            text,
  src_row              integer,
  needs_review         boolean not null default false,
  raw                  jsonb,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (src_sheet, src_row)        -- idempotent imports; NULLs (manual entries) stay distinct
);
create index if not exists deliveries_task_date_idx on deliveries (task_date);
create index if not exists deliveries_booking_date_idx on deliveries (booking_date);
create index if not exists deliveries_knight_idx on deliveries (knight_id);
create index if not exists deliveries_payment_status_idx on deliveries (payment_status);
create index if not exists deliveries_client_idx on deliveries (client_id);
create index if not exists deliveries_needs_review_idx on deliveries (needs_review) where needs_review;
create trigger deliveries_set_updated_at before update on deliveries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: lock everything down. The server uses the service-role
-- key (which bypasses RLS); no anon/authenticated policies are created.
-- ---------------------------------------------------------------------------
alter table knights            enable row level security;
alter table knight_salaries    enable row level security;
alter table work_days          enable row level security;
alter table daily_assignments  enable row level security;
alter table clients            enable row level security;
alter table rate_tiers         enable row level security;
alter table deliveries         enable row level security;
