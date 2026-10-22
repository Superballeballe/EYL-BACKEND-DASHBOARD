alter table public.deliveries
  add column if not exists pickup_flat text,
  add column if not exists drop_flat text,
  add column if not exists pickup_contact_name text,
  add column if not exists pickup_contact_phone text;
