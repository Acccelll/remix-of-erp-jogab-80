
CREATE OR REPLACE FUNCTION public.fn_sync_lancamentos_on_centro_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (OLD.tipo IS DISTINCT FROM NEW.tipo OR OLD.obra_id IS DISTINCT FROM NEW.obra_id OR OLD.codigo IS DISTINCT FROM NEW.codigo)) THEN
    UPDATE public.financeiro_lancamentos l
       SET obra_id = NULL,
           centro_custo_tipo = 'nao_classificado',
           categoria_indireta = NULL
     WHERE l.centro_custo = COALESCE(OLD.codigo, NEW.codigo);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    UPDATE public.financeiro_lancamentos l
       SET obra_id = CASE WHEN NEW.tipo = 'obra' THEN NEW.obra_id ELSE NULL END,
           centro_custo_tipo = NEW.tipo,
           categoria_indireta = NEW.categoria
     WHERE l.centro_custo = NEW.codigo;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_centros_sync_lancamentos ON public.centros_custo_totvs;
CREATE TRIGGER trg_centros_sync_lancamentos
AFTER INSERT OR UPDATE OR DELETE ON public.centros_custo_totvs
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_lancamentos_on_centro_change();

-- Backfill retroativo dos lançamentos existentes
UPDATE public.financeiro_lancamentos l
   SET obra_id = CASE WHEN c.tipo = 'obra' THEN c.obra_id ELSE NULL END,
       centro_custo_tipo = c.tipo,
       categoria_indireta = c.categoria
  FROM public.centros_custo_totvs c
 WHERE c.codigo = l.centro_custo
   AND (
        l.centro_custo_tipo IS DISTINCT FROM c.tipo
     OR (c.tipo = 'obra' AND l.obra_id IS DISTINCT FROM c.obra_id)
     OR (c.tipo = 'indireto' AND l.categoria_indireta IS DISTINCT FROM c.categoria)
   );
