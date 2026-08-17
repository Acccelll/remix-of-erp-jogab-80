ALTER TABLE public.notificacoes ALTER COLUMN lida_por TYPE TEXT[] USING lida_por::TEXT[];
ALTER TABLE public.notificacoes ALTER COLUMN lida_por SET DEFAULT ARRAY[]::TEXT[];