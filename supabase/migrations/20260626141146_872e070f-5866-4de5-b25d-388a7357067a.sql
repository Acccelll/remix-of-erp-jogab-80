
CREATE TABLE IF NOT EXISTS public.alcadas_aprovacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_min numeric(14,2) NOT NULL DEFAULT 0,
  valor_max numeric(14,2),
  papel_aprovador text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alcadas_aprovacao TO authenticated;
GRANT ALL ON public.alcadas_aprovacao TO service_role;

ALTER TABLE public.alcadas_aprovacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alcadas_aprovacao read" ON public.alcadas_aprovacao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "alcadas_aprovacao write_gm" ON public.alcadas_aprovacao
  FOR ALL TO authenticated
  USING (public.current_is_gm())
  WITH CHECK (public.current_is_gm());

CREATE TRIGGER trg_alcadas_aprovacao_updated_at
  BEFORE UPDATE ON public.alcadas_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.ordens_compra
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacoes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.fn_oc_aprovar(p_oc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_status_aprov text;
  v_papeis text[];
  v_papel text;
  v_setores text[];
  v_atendidos text[];
  v_aprovacoes jsonb;
  v_ja_aprovou boolean := false;
  v_completo boolean := false;
BEGIN
  SELECT valor_total, status_aprovacao, aprovacoes
    INTO v_valor, v_status_aprov, v_aprovacoes
    FROM public.ordens_compra
   WHERE id = p_oc_id
   FOR UPDATE;

  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'OC não encontrada';
  END IF;
  IF v_status_aprov = 'aprovada' THEN
    RAISE EXCEPTION 'OC já aprovada';
  END IF;

  SELECT array_agg(papel_aprovador ORDER BY ordem)
    INTO v_papeis
    FROM public.alcadas_aprovacao
   WHERE valor_min <= v_valor
     AND (valor_max IS NULL OR valor_max >= v_valor);

  IF v_papeis IS NULL OR array_length(v_papeis,1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma alçada configurada cobre o valor %', v_valor;
  END IF;

  v_setores := public.current_setores();

  -- Identifica o papel da rodada atual: primeiro não-atendido na ordem.
  SELECT array_agg(elem->>'papel') INTO v_atendidos
    FROM jsonb_array_elements(COALESCE(v_aprovacoes, '[]'::jsonb)) elem;
  v_atendidos := COALESCE(v_atendidos, '{}');

  v_papel := NULL;
  FOREACH v_papel IN ARRAY v_papeis LOOP
    IF NOT (v_papel = ANY(v_atendidos)) THEN
      EXIT;
    END IF;
    v_papel := NULL;
  END LOOP;

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Todas as alçadas já foram aprovadas';
  END IF;

  IF NOT (public.current_is_gm() OR v_papel = ANY(v_setores)) THEN
    RAISE EXCEPTION 'Sem permissão: aprovação requer papel %', v_papel;
  END IF;

  v_aprovacoes := COALESCE(v_aprovacoes, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
         'papel', v_papel,
         'user_id', auth.uid(),
         'em', now()
       ));

  -- Completo quando todos os papéis foram atendidos.
  v_completo := (
    SELECT bool_and(p = ANY(
      ARRAY(SELECT jsonb_array_elements(v_aprovacoes)->>'papel')
    ))
    FROM unnest(v_papeis) p
  );

  UPDATE public.ordens_compra
     SET aprovacoes = v_aprovacoes,
         status_aprovacao = CASE WHEN v_completo THEN 'aprovada' ELSE 'pendente' END,
         aprovado_por = CASE WHEN v_completo THEN auth.uid() ELSE aprovado_por END,
         aprovado_em = CASE WHEN v_completo THEN now() ELSE aprovado_em END,
         updated_at = now()
   WHERE id = p_oc_id;

  RETURN jsonb_build_object(
    'aprovada', v_completo,
    'papel_aprovado', v_papel,
    'aprovacoes', v_aprovacoes,
    'papeis_exigidos', v_papeis
  );
END $$;

REVOKE ALL ON FUNCTION public.fn_oc_aprovar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_oc_aprovar(uuid) TO authenticated, service_role;

-- Seed inicial (idempotente por papel+ordem)
INSERT INTO public.alcadas_aprovacao (valor_min, valor_max, papel_aprovador, ordem)
SELECT 0, 5000, 'Compras', 1
WHERE NOT EXISTS (SELECT 1 FROM public.alcadas_aprovacao WHERE papel_aprovador='Compras' AND ordem=1);

INSERT INTO public.alcadas_aprovacao (valor_min, valor_max, papel_aprovador, ordem)
SELECT 5000.01, 50000, 'Gerencia', 1
WHERE NOT EXISTS (SELECT 1 FROM public.alcadas_aprovacao WHERE papel_aprovador='Gerencia' AND ordem=1);

INSERT INTO public.alcadas_aprovacao (valor_min, valor_max, papel_aprovador, ordem)
SELECT 50000.01, NULL, 'Diretoria', 1
WHERE NOT EXISTS (SELECT 1 FROM public.alcadas_aprovacao WHERE papel_aprovador='Diretoria' AND ordem=1);
