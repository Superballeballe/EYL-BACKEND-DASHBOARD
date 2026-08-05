alter table public.deliveries
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists drop_lat double precision,
  add column if not exists drop_lng double precision;
