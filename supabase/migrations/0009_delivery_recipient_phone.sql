alter table public.deliveries
  add column if not exists recipient_phone text;
