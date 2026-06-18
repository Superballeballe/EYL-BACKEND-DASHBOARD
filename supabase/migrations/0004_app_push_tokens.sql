-- Store Expo push tokens registered by the mobile app.
create table if not exists public.app_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_push_tokens_user_id_idx
  on public.app_push_tokens (user_id);

drop trigger if exists app_push_tokens_set_updated_at on public.app_push_tokens;
create trigger app_push_tokens_set_updated_at
  before update on public.app_push_tokens
  for each row execute function set_updated_at();

alter table public.app_push_tokens enable row level security;

do $$ begin
  create policy "read own push tokens" on public.app_push_tokens
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "insert own push tokens" on public.app_push_tokens
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "update own push tokens" on public.app_push_tokens
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
