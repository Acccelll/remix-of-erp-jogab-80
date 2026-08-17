
-- 1) Notificações: GRANTs faltando (policies já existem)
GRANT SELECT, INSERT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

-- 2) Cronograma: colunas para baseline/real/reprogramado/duração/restrições
ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS data_inicio_reprog date,
  ADD COLUMN IF NOT EXISTS data_fim_reprog    date,
  ADD COLUMN IF NOT EXISTS data_inicio_real   date,
  ADD COLUMN IF NOT EXISTS data_fim_real      date,
  ADD COLUMN IF NOT EXISTS duracao_horas      numeric,
  ADD COLUMN IF NOT EXISTS constraint_tipo    smallint,
  ADD COLUMN IF NOT EXISTS constraint_data    date,
  ADD COLUMN IF NOT EXISTS deadline           date,
  ADD COLUMN IF NOT EXISTS notas              text,
  ADD COLUMN IF NOT EXISTS prioridade         integer,
  ADD COLUMN IF NOT EXISTS marco              boolean DEFAULT false;

-- 3) Backfill helper: resolver predecessor_item_id por UID
CREATE OR REPLACE FUNCTION public.fn_backfill_cronograma_dep_item_id(p_obra_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.cronograma_dependencias d
     SET predecessor_item_id = i.id
    FROM public.cronograma_itens i
   WHERE d.obra_id = p_obra_id
     AND i.obra_id = p_obra_id
     AND d.predecessor_uid_mpp = i.uid_mpp
     AND d.predecessor_item_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_backfill_cronograma_dep_item_id(uuid) TO authenticated, service_role;

-- 4) Reverter revisão: copia snapshot de cronograma_item_revisoes → cronograma_itens
CREATE OR REPLACE FUNCTION public.fn_reverter_revisao_cronograma(p_revisao_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer; v_obra uuid;
BEGIN
  SELECT obra_id INTO v_obra FROM public.cronograma_revisoes WHERE id = p_revisao_id;
  IF v_obra IS NULL THEN RAISE EXCEPTION 'Revisão % não encontrada', p_revisao_id; END IF;

  UPDATE public.cronograma_itens ci
     SET data_inicio           = COALESCE(r.data_inicio_novo, ci.data_inicio),
         data_fim              = COALESCE(r.data_fim_novo, ci.data_fim),
         percentual_realizado  = COALESCE(r.percentual_realizado_novo, ci.percentual_realizado),
         custo                 = COALESCE(r.custo_novo, ci.custo)
    FROM public.cronograma_item_revisoes r
   WHERE r.revisao_id = p_revisao_id
     AND r.cronograma_item_id = ci.id
     AND ci.obra_id = v_obra;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_reverter_revisao_cronograma(uuid) TO authenticated, service_role;
