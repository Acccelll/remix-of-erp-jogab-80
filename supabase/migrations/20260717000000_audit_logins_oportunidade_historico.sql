-- Migração 2026-07-17: persistência de auditoria de login, histórico do CRM
-- e reforço de GRANTs em usuarios_matriz_permissoes.

-- =========================================================================
-- 1) Log de logins (Auditoria)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.audit_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  login text NOT NULL,
  nome text NULL,
  sucesso boolean NOT NULL DEFAULT true,
  user_agent text NULL,
  ip text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logins_user_created_idx
  ON public.audit_logins (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logins_created_idx
  ON public.audit_logins (created_at DESC);

GRANT SELECT, INSERT ON public.audit_logins TO authenticated;
GRANT SELECT, INSERT ON public.audit_logins TO anon; -- login pré-sessão
GRANT ALL ON public.audit_logins TO service_role;

ALTER TABLE public.audit_logins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logins_insert_all" ON public.audit_logins;
CREATE POLICY "audit_logins_insert_all"
  ON public.audit_logins FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logins_select_authenticated" ON public.audit_logins;
CREATE POLICY "audit_logins_select_authenticated"
  ON public.audit_logins FOR SELECT
  TO authenticated
  USING (true);

-- =========================================================================
-- 2) Histórico das oportunidades do CRM
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.oportunidade_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id text NOT NULL,
  tipo text NOT NULL,               -- criacao | edicao | movimento | comentario
  autor_id text NULL,
  autor_login text NULL,
  descricao text NOT NULL,
  detalhes jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oportunidade_historico_oport_idx
  ON public.oportunidade_historico (oportunidade_id, created_at DESC);

GRANT SELECT, INSERT ON public.oportunidade_historico TO authenticated;
GRANT ALL ON public.oportunidade_historico TO service_role;

ALTER TABLE public.oportunidade_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oport_hist_insert_authenticated" ON public.oportunidade_historico;
CREATE POLICY "oport_hist_insert_authenticated"
  ON public.oportunidade_historico FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "oport_hist_select_authenticated" ON public.oportunidade_historico;
CREATE POLICY "oport_hist_select_authenticated"
  ON public.oportunidade_historico FOR SELECT
  TO authenticated USING (true);

-- =========================================================================
-- 3) Reforço de GRANTs em usuarios_matriz_permissoes
--    (a tabela já é criada em 2026_07_16_usuarios_matriz_permissoes.sql)
-- =========================================================================
DO $$
BEGIN
  IF to_regclass('public.usuarios_matriz_permissoes') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios_matriz_permissoes TO authenticated';
    EXECUTE 'GRANT ALL ON public.usuarios_matriz_permissoes TO service_role';
  END IF;
END $$;
