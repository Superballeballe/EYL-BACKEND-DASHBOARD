-- Monthly coupons — shared with EYL-APP mobile app.
-- See also EYL-APP/supabase/snippets/monthly-coupons.sql

create table if not exists public.monthly_coupons (
  id uuid primary key default gen_random_uuid(),
  year_month text not null unique,
  code text not null,
  type text not null check (type in ('percent', 'flat')),
  value integer not null check (value > 0),
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monthly_coupons_year_month_idx on public.monthly_coupons (year_month);
create index if not exists monthly_coupons_code_idx on public.monthly_coupons (upper(code));

create or replace function public.touch_monthly_coupons_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_coupons_updated_at on public.monthly_coupons;
create trigger monthly_coupons_updated_at
  before update on public.monthly_coupons
  for each row execute function public.touch_monthly_coupons_updated_at();

alter table public.monthly_coupons enable row level security;

drop policy if exists monthly_coupons_read on public.monthly_coupons;
create policy monthly_coupons_read on public.monthly_coupons
  for select to authenticated
  using (true);

grant select on public.monthly_coupons to authenticated;
grant all on public.monthly_coupons to service_role;
