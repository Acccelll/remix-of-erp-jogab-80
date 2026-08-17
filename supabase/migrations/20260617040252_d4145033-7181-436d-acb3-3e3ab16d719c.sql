
-- Wave C: ajustes de schema para suportar componentes de obra portados
-- 1) cronograma_itens: folga_dias e critico (caminho crítico CPM)
ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS folga_dias integer,
  ADD COLUMN IF NOT EXISTS critico boolean NOT NULL DEFAULT false;

-- 2) cronograma_revisoes: baseline_id (vincula revisão a uma baseline)
ALTER TABLE public.cronograma_revisoes
  ADD COLUMN IF NOT EXISTS baseline_id uuid REFERENCES public.cronograma_baselines(id) ON DELETE SET NULL;

-- 3) riscos: probabilidade/impacto numéricos (1..5)
ALTER TABLE public.riscos
  ALTER COLUMN probabilidade TYPE integer USING NULLIF(probabilidade,'')::integer,
  ALTER COLUMN impacto TYPE integer USING NULLIF(impacto,'')::integer;

-- 4) centros_custo_totvs: owner_id + unique(owner_id, codigo)
ALTER TABLE public.centros_custo_totvs
  ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.centros_custo_totvs
  DROP CONSTRAINT IF EXISTS centros_custo_totvs_codigo_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'centros_custo_totvs_owner_codigo_key'
  ) THEN
    ALTER TABLE public.centros_custo_totvs
      ADD CONSTRAINT centros_custo_totvs_owner_codigo_key UNIQUE (owner_id, codigo);
  END IF;
END $$;

-- 5) RPCs stub para recálculo de NF/BMS (implementação completa virá em wave futura)
CREATE OR REPLACE FUNCTION public.fn_recalcular_previsao_nf(
  p_obra_id uuid,
  p_valor_contrato numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faturado numeric := 0;
  v_saldo numeric := 0;
  v_soma_prev numeric := 0;
  v_count integer := 0;
BEGIN
  SELECT COALESCE(SUM(valor),0) INTO v_faturado
  FROM public.notas_fiscais
  WHERE obra_id = p_obra_id AND COALESCE(status,'') <> 'cancelada';

  v_saldo := COALESCE(p_valor_contrato,0) - v_faturado;

  SELECT COALESCE(SUM(valor_previsto_dinamico),0), COUNT(*)
    INTO v_soma_prev, v_count
  FROM public.bms_previstas
  WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista';

  IF v_count = 0 THEN RETURN; END IF;

  IF v_soma_prev > 0 THEN
    UPDATE public.bms_previstas
      SET valor_previsto_dinamico = ROUND(valor_previsto_dinamico * v_saldo / v_soma_prev, 2)
      WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista';
  ELSE
    UPDATE public.bms_previstas
      SET valor_previsto_dinamico = ROUND(v_saldo / v_count, 2)
      WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_recalcular_apos_faturamento(
  p_obra_id uuid,
  p_nf_id uuid,
  p_valor_contrato numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor_faturado numeric := 0;
  v_delta numeric := 0;
  v_atualizadas integer := 0;
BEGIN
  SELECT COALESCE(valor,0) INTO v_valor_faturado
  FROM public.notas_fiscais WHERE id = p_nf_id;

  PERFORM public.fn_recalcular_previsao_nf(p_obra_id, p_valor_contrato);

  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;
  RETURN jsonb_build_object(
    'delta', v_delta,
    'futuras_atualizadas', v_atualizadas,
    'valor_faturado', v_valor_faturado
  );
END $$;

CREATE OR REPLACE FUNCTION public.fn_reverter_faturamento_bms(
  p_obra_id uuid,
  p_bms_id uuid,
  p_valor_contrato numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_recalcular_previsao_nf(p_obra_id, p_valor_contrato);
END $$;
