-- EYL live database verification (read-only)
-- Run in the Supabase SQL editor for the live project, or with:
--   psql "$DATABASE_URL" -f docs/api/live-verification.sql
-- Every statement below is a SELECT against PostgreSQL catalogs or
-- information_schema. It changes no schema, data, grants, or session settings.

-- 1. Row-level security policies on EYL core and sensitive tables.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by tablename, policyname;

-- 2. RLS flags and table ownership. relrowsecurity/relforcerowsecurity expose
-- tables that have RLS enabled even when no policies exist.
select
  n.nspname as table_schema,
  c.relname as table_name,
  pg_get_userbyid(c.relowner) as owner,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by c.relname;

-- 3. Explicit and effective table/view grants visible through
-- information_schema. Pay particular attention to anon, authenticated, and
-- PUBLIC grantees on dashboard, payment, refund, and account tables.
select
  grantor,
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable,
  with_hierarchy
from information_schema.table_privileges
where table_schema = 'public'
  and table_name in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by table_name, grantee, privilege_type;

-- 4. Definitions, signatures, owners, volatility, and SECURITY DEFINER state
-- for known EYL synchronization/payment RPCs plus any public SECURITY DEFINER
-- function whose definition references a scoped sensitive table.
with scoped_functions as (
  select p.oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      p.proname in (
        'delete_delivery',
        'finalize_order_on_invoice_paid',
        'haversine_km',
        'order_distance_km',
        'order_payment_mode',
        'order_payment_status',
        'orders_after_insert',
        'orders_after_update',
        'set_updated_at',
        'sync_delivery_payment_from_invoice',
        'sync_delivery_status_to_order',
        'sync_order_to_delivery',
        'touch_monthly_coupons_updated_at'
      )
      or (
        p.prosecdef
        and pg_get_functiondef(p.oid) ~
          '\m(deliveries|orders|invoices|cancelled_orders|refund_events|dashboard_users|dashboard_invites|profiles)\M'
      )
    )
)
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  case p.provolatile when 'i' then 'immutable' when 's' then 'stable' else 'volatile' end as volatility,
  p.proconfig as function_settings,
  pg_get_functiondef(p.oid) as definition
from scoped_functions sf
join pg_proc p on p.oid = sf.oid
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 5. EXECUTE grants for the same sensitive functions. PostgreSQL's default
-- function ACL grants EXECUTE to PUBLIC, so this expands default ACLs too.
with scoped_functions as (
  select p.*
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      p.proname in (
        'delete_delivery',
        'finalize_order_on_invoice_paid',
        'haversine_km',
        'order_distance_km',
        'order_payment_mode',
        'order_payment_status',
        'orders_after_insert',
        'orders_after_update',
        'set_updated_at',
        'sync_delivery_payment_from_invoice',
        'sync_delivery_status_to_order',
        'sync_order_to_delivery',
        'touch_monthly_coupons_updated_at'
      )
      or (
        p.prosecdef
        and pg_get_functiondef(p.oid) ~
          '\m(deliveries|orders|invoices|cancelled_orders|refund_events|dashboard_users|dashboard_invites|profiles)\M'
      )
    )
)
select
  'public' as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  coalesce(grantor.rolname, 'PUBLIC') as grantor,
  coalesce(grantee.rolname, 'PUBLIC') as grantee,
  x.privilege_type,
  x.is_grantable
from scoped_functions p
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
left join pg_roles grantor on grantor.oid = x.grantor
left join pg_roles grantee on grantee.oid = x.grantee
order by p.proname, identity_arguments, grantee;

-- 6. User-defined triggers and their complete definitions.
select
  n.nspname as table_schema,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled as enabled_code,
  pn.nspname as function_schema,
  p.proname as function_name,
  pg_get_triggerdef(t.oid, true) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
join pg_namespace pn on pn.oid = p.pronamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and c.relname in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by c.relname, t.tgname;

-- 7. Primary, unique, foreign-key, check, and exclusion constraints.
select
  n.nspname as table_schema,
  c.relname as table_name,
  con.conname as constraint_name,
  case con.contype
    when 'p' then 'PRIMARY KEY'
    when 'u' then 'UNIQUE'
    when 'f' then 'FOREIGN KEY'
    when 'c' then 'CHECK'
    when 'x' then 'EXCLUDE'
    else con.contype::text
  end as constraint_type,
  con.convalidated as validated,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by c.relname, constraint_type, con.conname;

-- 8. Supabase Realtime publication membership for scoped tables.
select
  pubname as publication_name,
  schemaname as table_schema,
  tablename as table_name,
  attnames as published_columns,
  rowfilter
from pg_publication_tables
where schemaname = 'public'
  and tablename in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by publication_name, table_name;

-- 9. Replica identity, needed to interpret Realtime UPDATE/DELETE payloads.
select
  n.nspname as table_schema,
  c.relname as table_name,
  case c.relreplident
    when 'd' then 'DEFAULT'
    when 'n' then 'NOTHING'
    when 'f' then 'FULL'
    when 'i' then 'INDEX'
  end as replica_identity,
  i.relname as identity_index
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_index ix on ix.indrelid = c.oid and ix.indisreplident
left join pg_class i on i.oid = ix.indexrelid
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in (
    'app_push_tokens',
    'cancelled_orders',
    'clients',
    'coupon_redemptions',
    'daily_assignments',
    'dashboard_email_verifications',
    'dashboard_invites',
    'dashboard_users',
    'deliveries',
    'eyl_knights',
    'invoices',
    'knight_salaries',
    'knights',
    'monthly_coupons',
    'orders',
    'pricing_config',
    'pricing_surcharges',
    'profiles',
    'rate_tiers',
    'refund_events',
    'work_days'
  )
order by c.relname;
