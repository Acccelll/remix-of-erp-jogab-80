CREATE OR REPLACE FUNCTION public.has_card_access(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((
      SELECT p.is_gm
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ), false)
    OR EXISTS (
      SELECT 1
      FROM public.card_setores cs
      JOIN public.user_setores us
        ON us.user_id = auth.uid()
       AND us.setor = cs.setor
      WHERE cs.card_id = p_card_id
    );
$$;

CREATE OR REPLACE FUNCTION public.has_card_setor(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_card_access(p_card_id);
$$;

CREATE INDEX IF NOT EXISTS idx_card_setores_setor_card
  ON public.card_setores (setor, card_id);

CREATE OR REPLACE FUNCTION public.refresh_mv_obra_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Acesso negado: GM requerido';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_obra_dashboard;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_card_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_card_setor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_card_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_card_setor(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() TO authenticated, service_role;