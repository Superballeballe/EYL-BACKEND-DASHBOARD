-- Walker vs biker role chosen during knight app registration.
alter table public.eyl_knights
  add column if not exists knight_role text check (knight_role in ('walker', 'biker'));

create index if not exists eyl_knights_knight_role_idx on public.eyl_knights (knight_role);
