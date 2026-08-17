-- Fase 2.3 — Write-back custo da atividade ← orçamento (não-invasivo)

CREATE OR REPLACE FUNCTION public.recalcular_custo_atividade(p_item uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(14,2);
BEGIN
  IF p_item IS NULL THEN RETURN; END IF;
  -- Só assume controle do custo se a atividade TEM orçamento.
  -- Sem orçamento → preserva o custo importado do MS Project.
  IF EXISTS (
    SELECT 1 FROM public.orcamento_itens WHERE cronograma_item_id = p_item
  ) THEN
    SELECT COALESCE(SUM(valor_total), 0) INTO v_total
      FROM public.orcamento_itens
     WHERE cronograma_item_id = p_item;
    UPDATE public.cronograma_itens
       SET custo = v_total, updated_at = now()
     WHERE id = p_item;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_orcamento_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalcula a atividade nova (NEW) e, se mudou de atividade, também a antiga (OLD).
  IF TG_OP = 'UPDATE' AND NEW.cronograma_item_id IS DISTINCT FROM OLD.cronograma_item_id THEN
    PERFORM public.recalcular_custo_atividade(OLD.cronograma_item_id);
  END IF;
  PERFORM public.recalcular_custo_atividade(COALESCE(NEW.cronograma_item_id, OLD.cronograma_item_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orcamento_after_change ON public.orcamento_itens;
CREATE TRIGGER orcamento_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_orcamento_recalc();

-- Ação "Aprovar orçamento → baseline": copia custo derivado para custo_baseline.
-- Necessária porque o EVM usa custo_baseline ?? custo.
CREATE OR REPLACE FUNCTION public.aprovar_orcamento_obra(p_obra uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Somente GM ou setor Engenharia podem aprovar
  IF NOT (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores())) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar orçamento (requer GM ou setor Engenharia)';
  END IF;
  UPDATE public.cronograma_itens c
     SET custo_baseline = c.custo,
         updated_at = now()
   WHERE c.obra_id = p_obra
     AND EXISTS (
       SELECT 1 FROM public.orcamento_itens o
        WHERE o.cronograma_item_id = c.id
     );
END;
$$;

-- Bloquear execução por anon/public; deixar disponível para authenticated chamar via RPC
REVOKE EXECUTE ON FUNCTION public.recalcular_custo_atividade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aprovar_orcamento_obra(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_obra(uuid) TO authenticated;