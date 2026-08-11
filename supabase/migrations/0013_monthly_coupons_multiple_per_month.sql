-- Align with EYL-APP: multiple coupons per month; unique coupon code (case-insensitive).

alter table public.monthly_coupons
  drop constraint if exists monthly_coupons_year_month_key;

create unique index if not exists monthly_coupons_code_unique
  on public.monthly_coupons (upper(code));
