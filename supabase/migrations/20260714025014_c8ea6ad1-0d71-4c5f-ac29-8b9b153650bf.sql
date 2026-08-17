ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fiscalizacao';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'qualidade';

CREATE OR REPLACE FUNCTION public.current_has_setor(p_setor text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND lower(translate(ur.role::text, 'çãáéíóúâêôõ', 'caaeiuaeoo')) = lower(translate(p_setor, 'çãáéíóúâêôõ', 'caaeiuaeoo'))
    );
$$;

REVOKE ALL ON FUNCTION public.current_has_setor(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_has_setor(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.current_has_setor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_has_setor(text) TO service_role;

CREATE OR REPLACE FUNCTION public.user_pode_editar_obra(p_obra uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = p_obra
        AND lower(coalesce(om.papel, '')) IN ('gestor', 'membro')
    );
$$;

REVOKE ALL ON FUNCTION public.user_pode_editar_obra(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_pode_editar_obra(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_pode_editar_obra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_pode_editar_obra(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.historico_medicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id uuid NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  status_anterior public.medicao_status,
  status_novo public.medicao_status NOT NULL,
  acao text NOT NULL CHECK (acao IN ('enviar', 'aprovar', 'rejeitar')),
  responsavel_id uuid,
  responsavel_login text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.historico_medicao TO authenticated;
GRANT ALL ON public.historico_medicao TO service_role;

ALTER TABLE public.historico_medicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_medicao_select_por_obra"
ON public.historico_medicao
FOR SELECT
TO authenticated
USING (public.user_em_obra(obra_id));

CREATE POLICY "historico_medicao_insert_controlado"
ON public.historico_medicao
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_gm()
  OR public.user_pode_editar_obra(obra_id)
);

CREATE POLICY "historico_medicao_service_all"
ON public.historico_medicao
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_historico_medicao_medicao ON public.historico_medicao(medicao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historico_medicao_obra ON public.historico_medicao(obra_id, created_at DESC);

CREATE TRIGGER trg_historico_medicao_touch_updated_at
BEFORE UPDATE ON public.historico_medicao
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.user_pode_aprovar_medicao(p_obra uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm()
    OR (
      public.user_pode_editar_obra(p_obra)
      AND (
        public.current_has_setor('fiscalizacao')
        OR public.current_has_setor('qualidade')
        OR public.current_has_setor('engenharia')
        OR public.current_has_setor('seguranca')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.user_pode_aprovar_medicao(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_pode_aprovar_medicao(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_pode_aprovar_medicao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_pode_aprovar_medicao(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.registrar_historico_medicao(
  p_medicao_id uuid,
  p_status_anterior public.medicao_status,
  p_status_novo public.medicao_status,
  p_acao text,
  p_responsavel_login text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_id uuid;
BEGIN
  SELECT obra_id INTO v_obra_id
  FROM public.medicoes
  WHERE id = p_medicao_id;

  IF v_obra_id IS NULL THEN
    RAISE EXCEPTION 'Medição não encontrada';
  END IF;

  IF p_acao = 'enviar' THEN
    IF NOT public.user_pode_editar_obra(v_obra_id) THEN
      RAISE EXCEPTION 'Sem permissão para enviar medição desta obra';
    END IF;
  ELSIF p_acao IN ('aprovar', 'rejeitar') THEN
    IF NOT public.user_pode_aprovar_medicao(v_obra_id) THEN
      RAISE EXCEPTION 'Apenas fiscalização/qualidade/engenharia pode aprovar ou rejeitar medição';
    END IF;
  ELSE
    RAISE EXCEPTION 'Ação inválida para histórico de medição';
  END IF;

  INSERT INTO public.historico_medicao (
    medicao_id,
    obra_id,
    status_anterior,
    status_novo,
    acao,
    responsavel_id,
    responsavel_login,
    motivo
  ) VALUES (
    p_medicao_id,
    v_obra_id,
    p_status_anterior,
    p_status_novo,
    p_acao,
    auth.uid(),
    NULLIF(p_responsavel_login, ''),
    NULLIF(p_motivo, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_historico_medicao(uuid, public.medicao_status, public.medicao_status, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_historico_medicao(uuid, public.medicao_status, public.medicao_status, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_historico_medicao(uuid, public.medicao_status, public.medicao_status, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_historico_medicao(uuid, public.medicao_status, public.medicao_status, text, text, text) TO service_role;