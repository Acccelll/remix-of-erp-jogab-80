
-- 1) Add origem + checklist_codigo to rdo for cutover tracking & idempotency
ALTER TABLE public.rdo
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'nativo',
  ADD COLUMN IF NOT EXISTS checklist_codigo text;

CREATE INDEX IF NOT EXISTS idx_rdo_origem ON public.rdo(origem);
CREATE INDEX IF NOT EXISTS idx_rdo_checklist_codigo ON public.rdo(checklist_codigo) WHERE checklist_codigo IS NOT NULL;

-- 2) Enrich rdo_efetivo to carry free-text fields when colaborador not yet resolved
ALTER TABLE public.rdo_efetivo
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'proprio',
  ADD COLUMN IF NOT EXISTS nome_livre text,
  ADD COLUMN IF NOT EXISTS funcao_livre text,
  ADD COLUMN IF NOT EXISTS entrada text,
  ADD COLUMN IF NOT EXISTS saida text;

-- 3) Enrich rdo_atividades to keep "qtd dia" and "qtd acumulada" separately
ALTER TABLE public.rdo_atividades
  ADD COLUMN IF NOT EXISTS quantidade_dia numeric,
  ADD COLUMN IF NOT EXISTS quantidade_acumulada numeric;

-- 4) RPC: atomic upsert from Checklist Fácil row
CREATE OR REPLACE FUNCTION public.rdo_upsert_from_checklist(
  p_obra_id uuid,
  p_data date,
  p_checklist_codigo text,
  p_clima_manha text,
  p_clima_tarde text,
  p_clima_noite text,
  p_trabalhavel_manha boolean,
  p_trabalhavel_tarde boolean,
  p_trabalhavel_noite boolean,
  p_observacoes text,
  p_atividades jsonb,   -- [{descricao, quantidade_dia, quantidade_acumulada}]
  p_efetivo jsonb,      -- [{tipo, nome_livre, funcao_livre, entrada, saida}]
  p_ocorrencias jsonb   -- [{tipo, descricao}]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdo_id uuid;
  v_item jsonb;
BEGIN
  INSERT INTO public.rdo (
    obra_id, data, clima_manha, clima_tarde, clima_noite,
    trabalhavel_manha, trabalhavel_tarde, trabalhavel_noite,
    observacoes, status, origem, checklist_codigo
  ) VALUES (
    p_obra_id, p_data, p_clima_manha, p_clima_tarde, p_clima_noite,
    p_trabalhavel_manha, p_trabalhavel_tarde, p_trabalhavel_noite,
    COALESCE(p_observacoes,''), 'concluido', 'checklist_facil', p_checklist_codigo
  )
  ON CONFLICT (obra_id, data) DO UPDATE SET
    clima_manha = EXCLUDED.clima_manha,
    clima_tarde = EXCLUDED.clima_tarde,
    clima_noite = EXCLUDED.clima_noite,
    trabalhavel_manha = EXCLUDED.trabalhavel_manha,
    trabalhavel_tarde = EXCLUDED.trabalhavel_tarde,
    trabalhavel_noite = EXCLUDED.trabalhavel_noite,
    observacoes = EXCLUDED.observacoes,
    status = EXCLUDED.status,
    origem = EXCLUDED.origem,
    checklist_codigo = EXCLUDED.checklist_codigo,
    updated_at = now()
  RETURNING id INTO v_rdo_id;

  DELETE FROM public.rdo_atividades WHERE rdo_id = v_rdo_id;
  DELETE FROM public.rdo_efetivo    WHERE rdo_id = v_rdo_id;
  DELETE FROM public.rdo_ocorrencias WHERE rdo_id = v_rdo_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_atividades,'[]'::jsonb)) LOOP
    INSERT INTO public.rdo_atividades (rdo_id, descricao, quantidade_dia, quantidade_acumulada)
    VALUES (
      v_rdo_id,
      COALESCE(v_item->>'descricao',''),
      NULLIF(v_item->>'quantidade_dia','')::numeric,
      NULLIF(v_item->>'quantidade_acumulada','')::numeric
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_efetivo,'[]'::jsonb)) LOOP
    INSERT INTO public.rdo_efetivo (rdo_id, tipo, nome_livre, funcao_livre, entrada, saida, quantidade, presente)
    VALUES (
      v_rdo_id,
      COALESCE(v_item->>'tipo','proprio'),
      v_item->>'nome_livre',
      v_item->>'funcao_livre',
      v_item->>'entrada',
      v_item->>'saida',
      1,
      true
    );
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_ocorrencias,'[]'::jsonb)) LOOP
    INSERT INTO public.rdo_ocorrencias (rdo_id, tipo, descricao)
    VALUES (
      v_rdo_id,
      COALESCE(v_item->>'tipo','ocorrencia'),
      COALESCE(v_item->>'descricao','')
    );
  END LOOP;

  RETURN v_rdo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rdo_upsert_from_checklist(
  uuid, date, text, text, text, text, boolean, boolean, boolean, text, jsonb, jsonb, jsonb
) TO authenticated, service_role;
