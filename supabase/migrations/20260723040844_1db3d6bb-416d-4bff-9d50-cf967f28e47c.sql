
-- 1) Revogar EXECUTE de anon em todas as funções SECURITY DEFINER do schema public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- 2) Revogar EXECUTE de authenticated em funções SECURITY DEFINER internas
--    (triggers e rotinas administrativas — não devem ser chamadas via API por usuários finais)
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_seed_plano_contas() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb) FROM authenticated;

-- 3) Helper: usuário logado é GM?
CREATE OR REPLACE FUNCTION public.is_current_player_gm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.players  pl ON pl.login = pr.login
    WHERE pr.id = auth.uid() AND pl.is_gm = true
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_current_player_gm() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_current_player_gm() TO authenticated;

-- 4) colaboradores — escrita restrita ao módulo 'dp' (ou GM via current_player_has_access)
DROP POLICY IF EXISTS colaboradores_auth_insert ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_auth_update ON public.colaboradores;
DROP POLICY IF EXISTS colaboradores_auth_delete ON public.colaboradores;

CREATE POLICY colaboradores_dp_insert ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (public.current_player_has_access('dp'));
CREATE POLICY colaboradores_dp_update ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (public.current_player_has_access('dp'))
  WITH CHECK (public.current_player_has_access('dp'));
CREATE POLICY colaboradores_dp_delete ON public.colaboradores
  FOR DELETE TO authenticated
  USING (public.current_player_has_access('dp'));

-- 5) dp_holerite — escrita restrita ao módulo 'dp'
DROP POLICY IF EXISTS dp_holerite_auth_insert ON public.dp_holerite;
DROP POLICY IF EXISTS dp_holerite_auth_update ON public.dp_holerite;
DROP POLICY IF EXISTS dp_holerite_auth_delete ON public.dp_holerite;

CREATE POLICY dp_holerite_dp_insert ON public.dp_holerite
  FOR INSERT TO authenticated
  WITH CHECK (public.current_player_has_access('dp'));
CREATE POLICY dp_holerite_dp_update ON public.dp_holerite
  FOR UPDATE TO authenticated
  USING (public.current_player_has_access('dp'))
  WITH CHECK (public.current_player_has_access('dp'));
CREATE POLICY dp_holerite_dp_delete ON public.dp_holerite
  FOR DELETE TO authenticated
  USING (public.current_player_has_access('dp'));

-- 6) Demais tabelas de folha/custo — gate 'dp' em leitura e escrita
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'custo_colaborador_competencia',
    'historico_salarial',
    'horas_extras',
    'decimo_terceiro',
    'provisoes',
    'fopag_entries'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auth_delete', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.current_player_has_access(''dp''))',
      t || '_dp_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.current_player_has_access(''dp''))',
      t || '_dp_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.current_player_has_access(''dp'')) WITH CHECK (public.current_player_has_access(''dp''))',
      t || '_dp_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.current_player_has_access(''dp''))',
      t || '_dp_delete', t);
  END LOOP;
END $$;

-- 7) players — leitura só do próprio registro (ou GM); escrita apenas GM
DROP POLICY IF EXISTS players_auth_select ON public.players;
DROP POLICY IF EXISTS players_auth_insert ON public.players;
DROP POLICY IF EXISTS players_auth_update ON public.players;
DROP POLICY IF EXISTS players_auth_delete ON public.players;

CREATE POLICY players_own_or_gm_select ON public.players
  FOR SELECT TO authenticated
  USING (
    public.is_current_player_gm()
    OR login = (SELECT pr.login FROM public.profiles pr WHERE pr.id = auth.uid())
  );
CREATE POLICY players_gm_insert ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (public.is_current_player_gm());
CREATE POLICY players_gm_update ON public.players
  FOR UPDATE TO authenticated
  USING (public.is_current_player_gm())
  WITH CHECK (public.is_current_player_gm());
CREATE POLICY players_gm_delete ON public.players
  FOR DELETE TO authenticated
  USING (public.is_current_player_gm());

-- 8) profiles — cada usuário só vê o próprio; GM vê todos
DROP POLICY IF EXISTS "profiles select authenticated" ON public.profiles;
CREATE POLICY profiles_own_or_gm_select ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_current_player_gm());
