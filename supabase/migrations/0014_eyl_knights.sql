-- App-side knight applicants (EYL Knight onboarding). Dashboard reads via service role;
-- knights upsert their own row from the mobile app using the anon key + RLS.

create table if not exists public.eyl_knights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete set null,
  name          text,
  phone         text,
  email         text,
  documents     jsonb not null default '{}'::jsonb,
  work_areas    text[] not null default '{}',
  status        text not null default 'pending'
                check (status in ('pending', 'documents', 'submitted', 'approved', 'rejected')),
  submitted_at  timestamptz,
  approved_at   timestamptz,
  rejected_at   timestamptz,
  review_note   text,
  knight_id     uuid references public.knights(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists eyl_knights_status_idx on public.eyl_knights (status);
create index if not exists eyl_knights_submitted_at_idx on public.eyl_knights (submitted_at desc nulls last);

drop trigger if exists eyl_knights_set_updated_at on public.eyl_knights;
create trigger eyl_knights_set_updated_at before update on public.eyl_knights
  for each row execute function set_updated_at();

alter table public.eyl_knights enable row level security;

do $$ begin
  create policy eyl_knights_self_select on public.eyl_knights
    for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy eyl_knights_self_insert on public.eyl_knights
    for insert to authenticated with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy eyl_knights_self_update on public.eyl_knights
    for update to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Private bucket for identity documents (paths stored in eyl_knights.documents).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knight-documents',
  'knight-documents',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  create policy knight_documents_insert_own on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'knight-documents'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy knight_documents_select_own on storage.objects
    for select to authenticated
    using (
      bucket_id = 'knight-documents'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy knight_documents_update_own on storage.objects
    for update to authenticated
    using (
      bucket_id = 'knight-documents'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;
