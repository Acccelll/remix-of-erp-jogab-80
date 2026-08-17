-- 1) Financeiro: restringir a authenticated
DROP POLICY IF EXISTS "fin_rollup planifik" ON public.financeiro_evolucao_rollup;
CREATE POLICY "fin_rollup_authenticated" ON public.financeiro_evolucao_rollup
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.financeiro_evolucao_rollup FROM anon;

DROP POLICY IF EXISTS "fin_matriz planifik" ON public.financeiro_matriz_rateios;
CREATE POLICY "fin_matriz_authenticated" ON public.financeiro_matriz_rateios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON public.financeiro_matriz_rateios FROM anon;

DROP POLICY IF EXISTS carrinho_all ON public.financeiro_previsao_carrinho;
CREATE POLICY carrinho_owner ON public.financeiro_previsao_carrinho
  FOR ALL TO authenticated
  USING (usuario_id::text = auth.uid()::text)
  WITH CHECK (usuario_id::text = auth.uid()::text);
REVOKE ALL ON public.financeiro_previsao_carrinho FROM anon;

DROP POLICY IF EXISTS carrinho_itens_all ON public.financeiro_previsao_carrinho_itens;
CREATE POLICY carrinho_itens_owner ON public.financeiro_previsao_carrinho_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.financeiro_previsao_carrinho c
                 WHERE c.id = carrinho_id AND c.usuario_id::text = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.financeiro_previsao_carrinho c
                 WHERE c.id = carrinho_id AND c.usuario_id::text = auth.uid()::text));
REVOKE ALL ON public.financeiro_previsao_carrinho_itens FROM anon;

DROP POLICY IF EXISTS carrinho_fechado_all ON public.financeiro_previsao_carrinho_fechado_itens;
CREATE POLICY carrinho_fechado_owner ON public.financeiro_previsao_carrinho_fechado_itens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.financeiro_previsao_carrinho c
                 WHERE c.id = carrinho_id AND c.usuario_id::text = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM public.financeiro_previsao_carrinho c
                 WHERE c.id = carrinho_id AND c.usuario_id::text = auth.uid()::text));
REVOKE ALL ON public.financeiro_previsao_carrinho_fechado_itens FROM anon;

-- 2) Helpers usados em policies saem do schema exposto
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.current_player_has_access(text) SET SCHEMA private;
ALTER FUNCTION public.is_current_player_gm() SET SCHEMA private;
ALTER FUNCTION public.is_board_member(uuid) SET SCHEMA private;
ALTER FUNCTION public.pode_ver_board(uuid, uuid) SET SCHEMA private;

ALTER FUNCTION private.current_player_has_access(text) SET search_path = public, private;
ALTER FUNCTION private.is_current_player_gm() SET search_path = public, private;
ALTER FUNCTION private.is_board_member(uuid) SET search_path = public, private;
ALTER FUNCTION private.pode_ver_board(uuid, uuid) SET search_path = public, private;

GRANT EXECUTE ON FUNCTION private.current_player_has_access(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_current_player_gm() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_board_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pode_ver_board(uuid, uuid) TO authenticated, service_role;

-- funções que chamam os helpers precisam enxergar o schema private
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ~* '(current_player_has_access|is_current_player_gm|is_board_member|pode_ver_board)'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, private', r.sig);
  END LOOP;
END $$;

-- 3) Nenhuma função SECURITY DEFINER em public executável por anon/authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;