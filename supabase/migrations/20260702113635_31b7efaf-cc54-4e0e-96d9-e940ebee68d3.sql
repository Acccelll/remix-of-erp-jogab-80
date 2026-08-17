
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  role_scope TEXT NOT NULL CHECK (role_scope IN ('compras','financeiro')),
  target_id TEXT,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  autor_login TEXT,
  autor_id UUID,
  lida_por UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read notificacoes"
  ON public.notificacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users can insert notificacoes"
  ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users can mark as read"
  ON public.notificacoes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_notificacoes_role_scope ON public.notificacoes(role_scope, created_at DESC);
