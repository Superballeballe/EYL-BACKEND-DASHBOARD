-- =====================================================================
-- RESET_all_data.sql — wipe ALL EYL app data (one-time clean slate).
--
-- Run in Supabase → SQL Editor (postgres role). IRREVERSIBLE.
--
-- Clears:
--   • Dashboard auth (dashboard_users, invites, email verifications)
--   • Ops data (deliveries, knights, lineup, clients, rates, …)
--   • Mobile app (orders, push tokens, auth.users)
--
-- Does NOT drop tables, triggers, or schema.
-- After this: sign up again at /login (first account = admin).
-- =====================================================================

begin;

-- Dashboard auth (child tables first)
truncate table public.dashboard_email_verifications restart identity cascade;
truncate table public.dashboard_invites restart identity cascade;
truncate table public.dashboard_users restart identity cascade;

-- Ops / dashboard business data
truncate table public.daily_assignments restart identity cascade;
truncate table public.knight_salaries restart identity cascade;
truncate table public.deliveries restart identity cascade;
truncate table public.work_days restart identity cascade;
truncate table public.knights restart identity cascade;
truncate table public.clients restart identity cascade;
truncate table public.rate_tiers restart identity cascade;

-- Mobile app (only if tables exist)
do $$ begin
  if to_regclass('public.app_push_tokens') is not null then
    truncate table public.app_push_tokens restart identity cascade;
  end if;
  if to_regclass('public.orders') is not null then
    truncate table public.orders restart identity cascade;
  end if;
end $$;

-- Mobile app Supabase Auth users (orders/tokens reference auth.users)
delete from auth.users;

commit;

-- Verify (all counts should be 0)
select 'dashboard_users' as tbl, count(*)::bigint as rows from public.dashboard_users
union all select 'dashboard_invites', count(*) from public.dashboard_invites
union all select 'dashboard_email_verifications', count(*) from public.dashboard_email_verifications
union all select 'deliveries', count(*) from public.deliveries
union all select 'knights', count(*) from public.knights
union all select 'clients', count(*) from public.clients
union all select 'rate_tiers', count(*) from public.rate_tiers
union all select 'work_days', count(*) from public.work_days
union all select 'daily_assignments', count(*) from public.daily_assignments
union all select 'knight_salaries', count(*) from public.knight_salaries
union all select 'auth.users', count(*) from auth.users;

do $$
begin
  if to_regclass('public.orders') is not null then
    raise notice 'orders remaining: %', (select count(*) from public.orders);
  end if;
  if to_regclass('public.app_push_tokens') is not null then
    raise notice 'app_push_tokens remaining: %', (select count(*) from public.app_push_tokens);
  end if;
end $$;
