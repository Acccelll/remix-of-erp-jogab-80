-- safe_uuid is used inside RLS policies; grant execute so API roles can evaluate those policies.
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO sandbox_exec;

-- Enforce the existing collaborator obra UUID validation for future writes.
ALTER TABLE public.colaboradores
  VALIDATE CONSTRAINT colaboradores_obra_atual_id_uuid_or_null_chk;

-- Tighten mobilization history: records with no source and no destination obra are GM-only.
DROP POLICY IF EXISTS "mobilizacoes_periodos read por obra ou rh" ON public.mobilizacoes_periodos;

CREATE POLICY "mobilizacoes_periodos read por obra ou rh vinculado"
ON public.mobilizacoes_periodos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    (public.safe_uuid(obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_id)))
    OR (public.safe_uuid(from_obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(from_obra_id)))
  )
  OR (
    public.current_has_setor('RH')
    AND (
      (public.safe_uuid(obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_id)))
      OR (public.safe_uuid(from_obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(from_obra_id)))
    )
  )
);