
-- Helper: check if current auth user has DP/HR access via linked player
CREATE OR REPLACE FUNCTION public.current_player_has_access(_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.players pl ON pl.login = pr.login
    WHERE pr.id = auth.uid()
      AND (
        pl.is_gm = true
        OR COALESCE(pl.acessos->>_module, 'nenhum') IN ('editar','visualizar')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_player_has_access(text) TO authenticated;

-- Restrict SELECT on colaboradores to DP-authorized users
DROP POLICY IF EXISTS colaboradores_auth_select ON public.colaboradores;
CREATE POLICY colaboradores_auth_select ON public.colaboradores
  FOR SELECT TO authenticated
  USING (public.current_player_has_access('dp'));

-- Restrict SELECT on dp_holerite to DP-authorized users
DROP POLICY IF EXISTS dp_holerite_auth_select ON public.dp_holerite;
CREATE POLICY dp_holerite_auth_select ON public.dp_holerite
  FOR SELECT TO authenticated
  USING (public.current_player_has_access('dp'));

-- Revoke direct read of players.senha from authenticated (column-level).
-- Grant SELECT on all other columns explicitly.
REVOKE SELECT ON public.players FROM authenticated;
GRANT SELECT (id, login, email, is_gm, acessos, created_at) ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
