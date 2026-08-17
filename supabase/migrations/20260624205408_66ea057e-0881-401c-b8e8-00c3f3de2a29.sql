
alter table public.notificacoes replica identity full;
alter publication supabase_realtime add table public.notificacoes;
