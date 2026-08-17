
-- =========================================================================
-- A) Lançamentos: backfill obra_id + trigger + view
-- =========================================================================

CREATE OR REPLACE FUNCTION public.fin_backfill_obra_id_from_centros()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.financeiro_lancamentos l
     SET obra_id = c.obra_id,
         centro_custo_tipo = 'obra'
    FROM public.centros_custo_totvs c
   WHERE c.codigo = l.centro_custo
     AND c.tipo = 'obra'
     AND c.obra_id IS NOT NULL
     AND (l.obra_id IS DISTINCT FROM c.obra_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_backfill_obra_id_from_centros() TO authenticated;

SELECT public.fin_backfill_obra_id_from_centros();

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

-- View: derive obra via centros quando l.obra_id ainda é nulo (defesa em profundidade)
CREATE OR REPLACE VIEW public.vw_financeiro_obra AS
WITH ultimo AS (
  SELECT financeiro_snapshots.id
    FROM public.financeiro_snapshots
   ORDER BY financeiro_snapshots.importado_em DESC
   LIMIT 1
)
SELECT l.id AS lancamento_id,
       COALESCE(l.obra_id, cct.obra_id) AS obra_id,
       o.nome AS obra_nome,
       o.codigo AS obra_codigo,
       l.centro_custo,
       l.desc_centro_custo,
       l.ref_lancamento,
       l.natureza_tipo,
       l.status_cod,
       l.status_label,
       l.nome AS contraparte,
       l.cliente_fornecedor,
       l.valor_liquido,
       l.valor_baixado,
       l.data_emissao,
       l.data_vencimento,
       l.data_pagamento,
       l.mes_competencia,
       l.origem,
       r.cod_natureza,
       r.desc_natureza,
       r.grupo,
       r.subgrupo,
       r.valor_rateio,
       r.status_lancamento
  FROM public.financeiro_lancamentos l
  JOIN ultimo u ON u.id = l.snapshot_id
  LEFT JOIN public.centros_custo_totvs cct
         ON cct.codigo = l.centro_custo AND cct.tipo = 'obra'
  LEFT JOIN public.obras o ON o.id = COALESCE(l.obra_id, cct.obra_id)
  LEFT JOIN public.financeiro_rateios r ON r.lancamento_id = l.id;

-- =========================================================================
-- B) Cronograma — paridade Contract Flow Tracker
-- =========================================================================

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS folga_livre_dias integer,
  ADD COLUMN IF NOT EXISTS fanout_sucessoras integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS importancia_score numeric,
  ADD COLUMN IF NOT EXISTS importancia_classe text,
  ADD COLUMN IF NOT EXISTS calendario_uid_mpp text;

ALTER TABLE public.cronograma_dependencias
  ADD COLUMN IF NOT EXISTS predecessor_item_id uuid REFERENCES public.cronograma_itens(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS lag_minutos integer;

CREATE INDEX IF NOT EXISTS idx_crono_deps_pred_item ON public.cronograma_dependencias(predecessor_item_id);

CREATE TABLE IF NOT EXISTS public.cronograma_calendarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  uid_mpp text NOT NULL,
  nome text,
  dias_uteis smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  horas_por_dia numeric(5,2) NOT NULL DEFAULT 8,
  is_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, uid_mpp)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_calendarios TO authenticated, anon;
GRANT ALL ON public.cronograma_calendarios TO service_role;
ALTER TABLE public.cronograma_calendarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_calendarios planifik" ON public.cronograma_calendarios;
CREATE POLICY "cronograma_calendarios planifik" ON public.cronograma_calendarios
  FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_calendarios_updated_at ON public.cronograma_calendarios;
CREATE TRIGGER trg_calendarios_updated_at
BEFORE UPDATE ON public.cronograma_calendarios
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.cronograma_calendario_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.cronograma_calendarios(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  trabalha boolean NOT NULL DEFAULT false,
  horas_disponiveis numeric(5,2),
  confirmada boolean NOT NULL DEFAULT true,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendario_excecoes_cal ON public.cronograma_calendario_excecoes(calendario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_calendario_excecoes TO authenticated, anon;
GRANT ALL ON public.cronograma_calendario_excecoes TO service_role;
ALTER TABLE public.cronograma_calendario_excecoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_calendario_excecoes planifik" ON public.cronograma_calendario_excecoes;
CREATE POLICY "cronograma_calendario_excecoes planifik" ON public.cronograma_calendario_excecoes
  FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fn_atualizar_cpm(p_obra_id uuid, p_resultados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cronograma_itens ci
     SET folga_dias         = r.folga_dias,
         critico            = r.critico,
         folga_livre_dias   = r.folga_livre_dias,
         fanout_sucessoras  = COALESCE(r.fanout, 0),
         importancia_score  = r.score,
         importancia_classe = r.classe
    FROM jsonb_to_recordset(p_resultados) AS r(
           id uuid,
           folga_dias int,
           critico boolean,
           folga_livre_dias int,
           fanout int,
           score numeric,
           classe text)
   WHERE ci.id = r.id AND ci.obra_id = p_obra_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_atualizar_cpm(uuid, jsonb) TO authenticated, anon;
