-- Enable websocket updates when admin approves/rejects a knight application.

do $$ begin
  alter publication supabase_realtime add table public.eyl_knights;
exception
  when duplicate_object then null;
end $$;
