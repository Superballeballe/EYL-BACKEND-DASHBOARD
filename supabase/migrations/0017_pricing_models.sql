-- Biker / walker pricing models, handling surcharges, and routing rules.

create table if not exists public.pricing_surcharges (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  label        text not null,
  amount       numeric(12,2) not null,
  note         text,
  is_current   boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger pricing_surcharges_set_updated_at
  before update on public.pricing_surcharges
  for each row execute function set_updated_at();

create table if not exists public.pricing_config (
  key          text primary key,
  value        jsonb not null,
  updated_at   timestamptz not null default now()
);

create trigger pricing_config_set_updated_at
  before update on public.pricing_config
  for each row execute function set_updated_at();

alter table public.pricing_surcharges enable row level security;
alter table public.pricing_config enable row level security;

-- Replace legacy EYL km cards with the current biker / walker models.
delete from public.rate_tiers
 where provider in (
   'eyl', 'eyl_biker', 'eyl_walker', 'eyl_walker_cab', 'eyl_walker_transit'
 );

insert into public.rate_tiers (provider, label, min_km, max_km, fee, is_current, note)
values
  ('eyl_biker', '1 – 1.5 km flat', 1, 1.5, 50, true, 'flat'),
  ('eyl_biker', '1.5 – 7 km', 1.5, 7, 25, true, 'per_km'),
  ('eyl_biker', '7 – 14 km', 7, 14, 21, true, 'per_km'),
  ('eyl_walker', 'Walker base (per km)', 0, null, 9, true, 'per_km'),
  ('eyl_walker_cab', 'Cab supplement (Uber / ride-hail API)', null, null, 0, true, 'uber_api'),
  ('eyl_walker_transit', 'Public transport (per km)', null, null, 12, true, 'per_km');

insert into public.pricing_surcharges (code, label, amount, note)
values
  (
    'delicate_handling',
    'Dedicated handling / glassware',
    50,
    'Fragile or glass items needing extra care'
  ),
  (
    'upright_cake_food_leakproof',
    'Upright / cake / food / leak-proof',
    100,
    'Cake, food, liquids, or must-stay-upright parcels'
  )
on conflict (code) do update set
  label = excluded.label,
  amount = excluded.amount,
  note = excluded.note,
  is_current = true,
  updated_at = now();

insert into public.pricing_config (key, value)
values
  (
    'routing_rules',
    '{
      "biker_max_distance_km": 14,
      "prefer_biker_when_km_lt": 14,
      "prefer_walker_when_km_gte": 14,
      "biker_excluded_surcharge_codes": ["upright_cake_food_leakproof"],
      "biker_excluded_handling_flags": [
        "isCake",
        "isFood",
        "delicateHandling",
        "keepUpright",
        "isLiquid",
        "temperatureSensitive"
      ]
    }'::jsonb
  ),
  (
    'walker_transport',
    '{
      "public_transport_per_km_inr": 12,
      "cab_fare_provider": "uber",
      "cab_fare_fallback_per_km_inr": 18,
      "modes": ["cab", "public_transit"]
    }'::jsonb
  )
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();

notify pgrst, 'reload schema';
