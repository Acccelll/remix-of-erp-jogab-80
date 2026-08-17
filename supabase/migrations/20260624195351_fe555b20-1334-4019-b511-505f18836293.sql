
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'patrimonios','veiculos','players','riscos','ocorrencias',
  'licoes_aprendidas','provisoes','controle_despesas'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allow all access to patrimonios" ON public.patrimonios;
DROP POLICY IF EXISTS "Allow all access to veiculos" ON public.veiculos;
DROP POLICY IF EXISTS "Allow all access to players" ON public.players;
DROP POLICY IF EXISTS "riscos planifik" ON public.riscos;
DROP POLICY IF EXISTS "ocorrencias planifik" ON public.ocorrencias;
DROP POLICY IF EXISTS "licoes_aprendidas planifik" ON public.licoes_aprendidas;
DROP POLICY IF EXISTS "Public access provisoes" ON public.provisoes;
DROP POLICY IF EXISTS "Public access controle_despesas" ON public.controle_despesas;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'patrimonios','veiculos','players','riscos','ocorrencias',
  'licoes_aprendidas','provisoes','controle_despesas'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||' read all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm())', t||' write gm', t);
  END LOOP;
END $$;

-- audit_logs: GM-only read, no writes from clients
REVOKE ALL ON public.audit_logs FROM anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs planifik" ON public.audit_logs;
CREATE POLICY "audit_logs read gm" ON public.audit_logs FOR SELECT TO authenticated USING (public.current_is_gm());
