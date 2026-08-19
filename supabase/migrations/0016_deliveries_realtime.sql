-- Live dashboard updates via Supabase Realtime (server subscribes with service role).
alter table public.deliveries replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.deliveries;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
