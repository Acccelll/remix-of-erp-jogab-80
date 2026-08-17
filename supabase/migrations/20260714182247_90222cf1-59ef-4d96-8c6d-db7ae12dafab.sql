-- Recria a estrutura ausente usada pela tela Evolução de Dívidas.
CREATE TABLE IF NOT EXISTS public.financeiro_evolucao_rollup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.financeiro_snapshots(id) ON DELETE SET NULL,
  data_snapshot DATE NOT NULL,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  status_cod SMALLINT,
  status_label TEXT,
  grupo TEXT,
  cod_natureza TEXT,
  desc_natureza TEXT,
  valor_aberto NUMERIC NOT NULL DEFAULT 0,
  valor_pago NUMERIC NOT NULL DEFAULT 0,
  qtd_titulos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_evolucao_rollup TO authenticated;
GRANT ALL ON public.financeiro_evolucao_rollup TO service_role;

ALTER TABLE public.financeiro_evolucao_rollup ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fin_rollup_snapshot ON public.financeiro_evolucao_rollup(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_fin_rollup_data ON public.financeiro_evolucao_rollup(data_snapshot);
CREATE INDEX IF NOT EXISTS idx_fin_rollup_obra ON public.financeiro_evolucao_rollup(obra_id);

DROP POLICY IF EXISTS "fin_rollup planifik" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "fin_roll_select" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "fin_roll_write" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "financeiro_evolucao_rollup_auth_select" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "financeiro_evolucao_rollup_financeiro_insert" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "financeiro_evolucao_rollup_financeiro_update" ON public.financeiro_evolucao_rollup;
DROP POLICY IF EXISTS "financeiro_evolucao_rollup_financeiro_delete" ON public.financeiro_evolucao_rollup;

CREATE POLICY "financeiro_evolucao_rollup_auth_select"
ON public.financeiro_evolucao_rollup
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "financeiro_evolucao_rollup_financeiro_insert"
ON public.financeiro_evolucao_rollup
FOR INSERT
TO authenticated
WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "financeiro_evolucao_rollup_financeiro_update"
ON public.financeiro_evolucao_rollup
FOR UPDATE
TO authenticated
USING (public.current_has_setor('financeiro'))
WITH CHECK (public.current_has_setor('financeiro'));

CREATE POLICY "financeiro_evolucao_rollup_financeiro_delete"
ON public.financeiro_evolucao_rollup
FOR DELETE
TO authenticated
USING (public.current_has_setor('financeiro'));

-- Função auxiliar central: materializa o rollup de um snapshot importado.
CREATE OR REPLACE FUNCTION public.fn_materializar_financeiro_evolucao_rollup(p_snapshot_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data_snapshot date;
  v_rows integer := 0;
BEGIN
  SELECT importado_em::date INTO v_data_snapshot
  FROM public.financeiro_snapshots
  WHERE id = p_snapshot_id;

  IF v_data_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot financeiro não encontrado: %', p_snapshot_id;
  END IF;

  DELETE FROM public.financeiro_evolucao_rollup
  WHERE snapshot_id = p_snapshot_id;

  WITH fatias_matriz AS (
    SELECT
      l.id AS lancamento_id,
      l.ref_lancamento,
      l.status_cod,
      l.status_label,
      l.valor_liquido AS titulo_valor_liquido,
      l.valor_baixado AS titulo_valor_baixado,
      m.cod_natureza,
      m.desc_natureza,
      COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza, ''), '.', 1)) AS grupo,
      m.cod_ccusto,
      m.valor_rateio,
      COALESCE(cct.obra_id, l.obra_id) AS fatia_obra_id
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
    WHERE l.snapshot_id = p_snapshot_id
      AND COALESCE(l.status_cod, 0) <> 18
  ),
  titulos_sem_matriz AS (
    SELECT
      l.id AS lancamento_id,
      l.ref_lancamento,
      l.status_cod,
      l.status_label,
      l.valor_liquido AS titulo_valor_liquido,
      l.valor_baixado AS titulo_valor_baixado,
      NULL::text AS cod_natureza,
      NULL::text AS desc_natureza,
      'sem_natureza'::text AS grupo,
      l.centro_custo AS cod_ccusto,
      GREATEST(COALESCE(l.valor_liquido, 0), 0) AS valor_rateio,
      l.obra_id AS fatia_obra_id
    FROM public.financeiro_lancamentos l
    WHERE l.snapshot_id = p_snapshot_id
      AND COALESCE(l.status_cod, 0) <> 18
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_matriz_rateios m
        WHERE m.ref_lancamento = l.ref_lancamento
      )
  ),
  fatias AS (
    SELECT * FROM fatias_matriz
    UNION ALL
    SELECT * FROM titulos_sem_matriz
  ),
  normalizado AS (
    SELECT
      f.*,
      SUM(GREATEST(COALESCE(f.valor_rateio, 0), 0)) OVER (PARTITION BY f.lancamento_id) AS soma_rateios,
      CASE
        WHEN f.status_cod = 3 THEN 1::numeric
        WHEN COALESCE(f.titulo_valor_liquido, 0) = 0 THEN 0::numeric
        ELSE LEAST(1::numeric, GREATEST(0::numeric,
          COALESCE(f.titulo_valor_baixado, 0) / NULLIF(f.titulo_valor_liquido, 0)))
      END AS ratio_pago
    FROM fatias f
  ),
  calc AS (
    SELECT
      n.*,
      CASE
        WHEN COALESCE(n.soma_rateios, 0) = 0 THEN 0::numeric
        ELSE GREATEST(COALESCE(n.valor_rateio, 0), 0) / n.soma_rateios
      END AS peso_fatia
    FROM normalizado n
  ),
  agg AS (
    SELECT
      v_data_snapshot AS data_snapshot,
      fatia_obra_id AS obra_id,
      status_cod,
      MAX(status_label) AS status_label,
      grupo,
      cod_natureza,
      MAX(desc_natureza) AS desc_natureza,
      ROUND(SUM(COALESCE(titulo_valor_liquido, 0) * peso_fatia * (1 - ratio_pago))::numeric, 2) AS valor_aberto,
      ROUND(SUM(COALESCE(titulo_valor_liquido, 0) * peso_fatia * ratio_pago)::numeric, 2) AS valor_pago,
      COUNT(DISTINCT lancamento_id) AS qtd_titulos
    FROM calc
    GROUP BY fatia_obra_id, status_cod, grupo, cod_natureza
  ),
  ins AS (
    INSERT INTO public.financeiro_evolucao_rollup (
      snapshot_id, data_snapshot, obra_id, status_cod, status_label,
      grupo, cod_natureza, desc_natureza, valor_aberto, valor_pago, qtd_titulos
    )
    SELECT
      p_snapshot_id, data_snapshot, obra_id, status_cod, status_label,
      grupo, cod_natureza, desc_natureza, valor_aberto, valor_pago, qtd_titulos
    FROM agg
    WHERE COALESCE(valor_aberto, 0) <> 0 OR COALESCE(valor_pago, 0) <> 0 OR qtd_titulos > 0
    RETURNING id
  )
  SELECT count(*) INTO v_rows FROM ins;

  RETURN v_rows;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_materializar_financeiro_evolucao_rollup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_materializar_financeiro_evolucao_rollup(uuid) TO service_role;

-- Importação atual usada pela tela: agora grava o rollup automaticamente.
CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(p_periodo_ref text, p_nome_titulos text, p_lancamentos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot_id UUID;
  v_total_titulos INT := 0;
  v_total_rateios INT := 0;
  v_total_valor NUMERIC := 0;
  v_sem_obra INT := 0;
  v_novos_sem_natureza INT := 0;
  v_matriz_em TIMESTAMPTZ;
  v_rollup_rows INT := 0;
  v_purged INT := 0;
BEGIN
  INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
  VALUES (p_periodo_ref, p_nome_titulos)
  RETURNING id INTO v_snapshot_id;

  WITH src AS (
    SELECT (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
      NULLIF(e->>'filial','')::INT AS filial,
      e->>'centro_custo' AS centro_custo,
      e->>'desc_centro_custo' AS desc_centro_custo,
      NULLIF(e->>'natureza_tipo','')::SMALLINT AS natureza_tipo,
      NULLIF(e->>'status_cod','')::SMALLINT AS status_cod,
      e->>'status_label' AS status_label,
      e->>'tipo_documento' AS tipo_documento,
      e->>'numero_documento' AS numero_documento,
      e->>'cnpj_cpf' AS cnpj_cpf,
      e->>'nome' AS nome,
      e->>'nome_fantasia' AS nome_fantasia,
      e->>'cliente_fornecedor' AS cliente_fornecedor,
      COALESCE((e->>'valor_original')::NUMERIC,0) AS valor_original,
      COALESCE((e->>'valor_desconto')::NUMERIC,0) AS valor_desconto,
      COALESCE((e->>'valor_liquido')::NUMERIC,0) AS valor_liquido,
      COALESCE((e->>'valor_baixado')::NUMERIC,0) AS valor_baixado,
      NULLIF(e->>'data_emissao','')::DATE AS data_emissao,
      NULLIF(e->>'data_vencimento','')::DATE AS data_vencimento,
      NULLIF(e->>'data_baixa','')::DATE AS data_baixa,
      NULLIF(e->>'data_pagamento','')::DATE AS data_pagamento,
      NULLIF(e->>'dias_atraso','')::INT AS dias_atraso,
      NULLIF(e->>'mes_competencia','')::DATE AS mes_competencia,
      e->>'historico' AS historico
    FROM jsonb_array_elements(COALESCE(p_lancamentos,'[]'::jsonb)) AS e
    WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL
  ),
  inseridos AS (
    INSERT INTO public.financeiro_lancamentos (
      snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
      obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
      cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
      valor_original, valor_desconto, valor_liquido, valor_baixado,
      data_emissao, data_vencimento, data_baixa, data_pagamento,
      dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta, origem
    )
    SELECT v_snapshot_id, s.ref_lancamento, s.filial, s.centro_custo, s.desc_centro_custo,
      cct.obra_id, s.natureza_tipo, s.status_cod, s.status_label,
      s.tipo_documento, s.numero_documento, s.cnpj_cpf, s.nome, s.nome_fantasia, s.cliente_fornecedor,
      s.valor_original, s.valor_desconto, s.valor_liquido, s.valor_baixado,
      s.data_emissao, s.data_vencimento, s.data_baixa, s.data_pagamento,
      s.dias_atraso, s.mes_competencia, s.historico,
      COALESCE(cct.tipo, 'nao_classificado'), cct.categoria, 'totvs'
    FROM src s
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = s.centro_custo
    RETURNING id, obra_id, valor_liquido, ref_lancamento
  )
  SELECT COUNT(*), COALESCE(SUM(valor_liquido),0), COUNT(*) FILTER (WHERE obra_id IS NULL)
    INTO v_total_titulos, v_total_valor, v_sem_obra
  FROM inseridos;

  WITH ins AS (
    INSERT INTO public.financeiro_rateios (
      lancamento_id, cod_natureza, desc_natureza, grupo, subgrupo, valor_rateio, status_lancamento
    )
    SELECT l.id, m.cod_natureza, m.desc_natureza,
      COALESCE(m.grupo, split_part(m.cod_natureza,'.',1)),
      COALESCE(m.subgrupo,
        CASE WHEN m.cod_natureza ~ '^[0-9]+\.[0-9]+'
          THEN split_part(m.cod_natureza,'.',1)||'.'||split_part(m.cod_natureza,'.',2)
          ELSE NULL END),
      m.valor_rateio, m.situacao_presumida
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
    WHERE l.snapshot_id = v_snapshot_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_total_rateios FROM ins;

  WITH upd AS (
    UPDATE public.financeiro_lancamentos l
    SET pendente_natureza = TRUE
    WHERE l.snapshot_id = v_snapshot_id
      AND NOT EXISTS (
        SELECT 1 FROM public.financeiro_matriz_rateios m
        WHERE m.ref_lancamento = l.ref_lancamento
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_novos_sem_natureza FROM upd;

  SELECT MAX(atualizado_em) INTO v_matriz_em FROM public.financeiro_matriz_rateios;

  v_rollup_rows := public.fn_materializar_financeiro_evolucao_rollup(v_snapshot_id);

  UPDATE public.financeiro_snapshots
  SET total_titulos = v_total_titulos,
      total_rateios = v_total_rateios,
      total_valor = v_total_valor,
      titulos_sem_obra = v_sem_obra,
      novos_sem_natureza = v_novos_sem_natureza,
      matriz_atualizada_em = v_matriz_em
  WHERE id = v_snapshot_id;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
    FROM public.financeiro_snapshots
  ), deleted AS (
    DELETE FROM public.financeiro_snapshots WHERE id IN (SELECT id FROM ranked WHERE rn > 12) RETURNING id
  )
  SELECT COUNT(*) INTO v_purged FROM deleted;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'total_titulos', v_total_titulos,
    'total_rateios', v_total_rateios,
    'total_valor', v_total_valor,
    'titulos_sem_obra', v_sem_obra,
    'novos_sem_natureza', v_novos_sem_natureza,
    'rollup_linhas', v_rollup_rows,
    'snapshots_purgados', v_purged,
    'matriz_atualizada_em', v_matriz_em
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) TO service_role;