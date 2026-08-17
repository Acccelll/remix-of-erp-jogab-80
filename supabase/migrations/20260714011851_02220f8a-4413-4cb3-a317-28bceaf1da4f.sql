-- PRO-003 · slice-04 — Fechamento de competência DP (backend + auditoria + RLS).

CREATE TABLE IF NOT EXISTS public.dp_fechamento_competencia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia TEXT NOT NULL,
  fechado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_por TEXT NOT NULL,
  motivo TEXT,
  reaberto_em TIMESTAMPTZ,
  reaberto_por TEXT,
  motivo_reabertura TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dp_fechamento_competencia_formato_chk CHECK (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX IF NOT EXISTS dp_fechamento_competencia_ativa_uidx
  ON public.dp_fechamento_competencia (competencia)
  WHERE reaberto_em IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.dp_fechamento_competencia TO authenticated;
GRANT ALL ON public.dp_fechamento_competencia TO service_role;

ALTER TABLE public.dp_fechamento_competencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_fech leitura autenticada" ON public.dp_fechamento_competencia;
CREATE POLICY "dp_fech leitura autenticada"
  ON public.dp_fechamento_competencia FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "dp_fech escrita gm" ON public.dp_fechamento_competencia;
CREATE POLICY "dp_fech escrita gm"
  ON public.dp_fechamento_competencia FOR ALL
  TO authenticated
  USING (public.current_is_gm())
  WITH CHECK (public.current_is_gm());

DROP TRIGGER IF EXISTS dp_fech_touch_updated_at ON public.dp_fechamento_competencia;
CREATE TRIGGER dp_fech_touch_updated_at
  BEFORE UPDATE ON public.dp_fechamento_competencia
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Fechar competência (idempotente na regra: falha se já houver fechamento ativo).
CREATE OR REPLACE FUNCTION public.dp_fechar_competencia(
  p_competencia TEXT,
  p_fechado_por TEXT,
  p_motivo TEXT DEFAULT NULL
) RETURNS public.dp_fechamento_competencia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.dp_fechamento_competencia;
BEGIN
  IF NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Sem permissão para fechar competência.' USING ERRCODE = '42501';
  END IF;
  IF p_competencia IS NULL OR p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida (use YYYY-MM).' USING ERRCODE = '22023';
  END IF;
  IF p_fechado_por IS NULL OR btrim(p_fechado_por) = '' THEN
    RAISE EXCEPTION 'Responsável obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.dp_fechamento_competencia
    WHERE competencia = p_competencia AND reaberto_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Competência % já está fechada.', p_competencia USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.dp_fechamento_competencia (competencia, fechado_por, motivo)
  VALUES (p_competencia, btrim(p_fechado_por), NULLIF(btrim(COALESCE(p_motivo, '')), ''))
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs (entidade, entidade_id, acao, before, after, user_id)
  VALUES ('dp_fechamento_competencia', v_row.id, 'insert', NULL, to_jsonb(v_row), auth.uid());

  RETURN v_row;
END $$;

-- Reabrir competência (marca reaberto_em / motivo obrigatório).
CREATE OR REPLACE FUNCTION public.dp_reabrir_competencia(
  p_competencia TEXT,
  p_reaberto_por TEXT,
  p_motivo_reabertura TEXT
) RETURNS public.dp_fechamento_competencia
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.dp_fechamento_competencia;
  v_after public.dp_fechamento_competencia;
BEGIN
  IF NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Sem permissão para reabrir competência.' USING ERRCODE = '42501';
  END IF;
  IF p_reaberto_por IS NULL OR btrim(p_reaberto_por) = '' THEN
    RAISE EXCEPTION 'Responsável obrigatório.' USING ERRCODE = '22023';
  END IF;
  IF p_motivo_reabertura IS NULL OR btrim(p_motivo_reabertura) = '' THEN
    RAISE EXCEPTION 'Motivo da reabertura é obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before FROM public.dp_fechamento_competencia
   WHERE competencia = p_competencia AND reaberto_em IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Competência % não está fechada.', p_competencia USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.dp_fechamento_competencia
     SET reaberto_em = now(),
         reaberto_por = btrim(p_reaberto_por),
         motivo_reabertura = btrim(p_motivo_reabertura)
   WHERE id = v_before.id
   RETURNING * INTO v_after;

  INSERT INTO public.audit_logs (entidade, entidade_id, acao, before, after, user_id)
  VALUES ('dp_fechamento_competencia', v_after.id, 'update', to_jsonb(v_before), to_jsonb(v_after), auth.uid());

  RETURN v_after;
END $$;

REVOKE ALL ON FUNCTION public.dp_fechar_competencia(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dp_fechar_competencia(TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.dp_reabrir_competencia(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dp_reabrir_competencia(TEXT, TEXT, TEXT) TO authenticated;
