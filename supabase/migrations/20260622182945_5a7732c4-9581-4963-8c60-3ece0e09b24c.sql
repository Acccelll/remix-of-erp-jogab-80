
-- ============================================================
-- fn_importar_matriz: substitui o conteúdo da matriz orçamentária
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_importar_matriz(p_rateios jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_total INT := 0;
  v_titulos INT := 0;
BEGIN
  DELETE FROM public.financeiro_matriz_rateios;

  WITH src AS (
    SELECT (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
      NULLIF(e->>'cod_natureza','') AS cod_natureza,
      NULLIF(e->>'desc_natureza','') AS desc_natureza,
      NULLIF(e->>'grupo','') AS grupo,
      NULLIF(e->>'subgrupo','') AS subgrupo,
      NULLIF(e->>'cod_ccusto','') AS cod_ccusto,
      NULLIF(e->>'desc_ccusto','') AS desc_ccusto,
      COALESCE((e->>'valor_rateio')::NUMERIC, 0) AS valor_rateio,
      COALESCE((e->>'valor_original')::NUMERIC, 0) AS valor_original,
      NULLIF(e->>'situacao_presumida','') AS situacao_presumida
    FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
    WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL
  ),
  ins AS (
    INSERT INTO public.financeiro_matriz_rateios (
      ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
      cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
      atualizado_em
    )
    SELECT ref_lancamento, cod_natureza, desc_natureza,
      COALESCE(grupo, split_part(cod_natureza, '.', 1)),
      COALESCE(subgrupo,
        CASE WHEN cod_natureza ~ '^[0-9]+\.[0-9]+'
          THEN split_part(cod_natureza,'.',1)||'.'||split_part(cod_natureza,'.',2)
          ELSE split_part(cod_natureza,'.',1) END),
      cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
      now()
    FROM src
    RETURNING ref_lancamento
  )
  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento) INTO v_total, v_titulos FROM ins;

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos
  );
END
$function$;

-- ============================================================
-- fn_importar_relatorio_totvs: importa snapshot do relatório rápido,
-- reconcilia contra a matriz e popula o rollup de evolução.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(
  p_periodo_ref text,
  p_nome_titulos text,
  p_lancamentos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_snapshot_id UUID;
  v_data_snapshot DATE := CURRENT_DATE;
  v_matriz_atualizada_em TIMESTAMPTZ;
  v_total_titulos INT := 0;
  v_total_valor NUMERIC := 0;
  v_sem_obra INT := 0;
  v_total_rateios INT := 0;
  v_pendentes INT := 0;
  v_rollup_rows INT := 0;
  v_purged INT := 0;
BEGIN
  SELECT MAX(atualizado_em) INTO v_matriz_atualizada_em
  FROM public.financeiro_matriz_rateios;

  INSERT INTO public.financeiro_snapshots (
    periodo_ref, nome_arquivo_titulos, matriz_atualizada_em
  )
  VALUES (p_periodo_ref, p_nome_titulos, v_matriz_atualizada_em)
  RETURNING id INTO v_snapshot_id;

  -- 1) Insere os títulos a partir do relatório, classificando por CCusto do título.
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
      dias_atraso, mes_competencia, historico,
      centro_custo_tipo, categoria_indireta, origem
    )
    SELECT v_snapshot_id, s.ref_lancamento, s.filial, s.centro_custo, s.desc_centro_custo,
      cct.obra_id, s.natureza_tipo, s.status_cod, s.status_label,
      s.tipo_documento, s.numero_documento, s.cnpj_cpf, s.nome, s.nome_fantasia, s.cliente_fornecedor,
      s.valor_original, s.valor_desconto, s.valor_liquido, s.valor_baixado,
      s.data_emissao, s.data_vencimento, s.data_baixa, s.data_pagamento,
      s.dias_atraso, s.mes_competencia, s.historico,
      COALESCE(cct.tipo,'nao_classificado'), cct.categoria, 'totvs'
    FROM src s LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = s.centro_custo
    RETURNING id, obra_id, valor_liquido
  )
  SELECT COUNT(*), COALESCE(SUM(valor_liquido),0), COUNT(*) FILTER (WHERE obra_id IS NULL)
    INTO v_total_titulos, v_total_valor, v_sem_obra
  FROM inseridos;

  -- 2) Reconciliação: copia fatias da matriz para financeiro_rateios.
  WITH ins AS (
    INSERT INTO public.financeiro_rateios (
      lancamento_id, cod_natureza, desc_natureza, grupo, subgrupo,
      valor_rateio, status_lancamento
    )
    SELECT l.id, m.cod_natureza, m.desc_natureza, m.grupo, m.subgrupo,
      m.valor_rateio, l.status_label
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
    WHERE l.snapshot_id = v_snapshot_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_total_rateios FROM ins;

  -- 3) Marca pendente_natureza nos títulos sem correspondência.
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
  SELECT COUNT(*) INTO v_pendentes FROM upd;

  -- 4) Popula o rollup no grão da fatia. obra_id da fatia vem do cod_ccusto da fatia.
  WITH fatias AS (
    SELECT
      l.ref_lancamento,
      l.status_cod,
      l.status_label,
      l.valor_liquido AS titulo_valor_liquido,
      l.valor_baixado AS titulo_valor_baixado,
      m.cod_natureza,
      m.desc_natureza,
      m.grupo,
      m.cod_ccusto,
      m.valor_rateio,
      cct.obra_id AS fatia_obra_id
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
    WHERE l.snapshot_id = v_snapshot_id
      AND COALESCE(l.status_cod, 0) <> 18  -- ignora cancelado
  ),
  calc AS (
    SELECT
      f.*,
      CASE
        WHEN f.status_cod = 3 THEN 1::NUMERIC
        WHEN COALESCE(f.titulo_valor_liquido, 0) = 0 THEN 0::NUMERIC
        ELSE LEAST(1::NUMERIC, GREATEST(0::NUMERIC,
          f.titulo_valor_baixado / NULLIF(f.titulo_valor_liquido, 0)))
      END AS ratio_pago
    FROM fatias f
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
      ROUND(SUM(valor_rateio - (valor_rateio * ratio_pago))::NUMERIC, 2) AS valor_aberto,
      ROUND(SUM(valor_rateio * ratio_pago)::NUMERIC, 2) AS valor_pago,
      COUNT(DISTINCT ref_lancamento) AS qtd_titulos
    FROM calc
    GROUP BY fatia_obra_id, status_cod, grupo, cod_natureza
  ),
  ins AS (
    INSERT INTO public.financeiro_evolucao_rollup (
      snapshot_id, data_snapshot, obra_id, status_cod, status_label,
      grupo, cod_natureza, desc_natureza,
      valor_aberto, valor_pago, qtd_titulos
    )
    SELECT v_snapshot_id, data_snapshot, obra_id, status_cod, status_label,
      grupo, cod_natureza, desc_natureza,
      valor_aberto, valor_pago, qtd_titulos
    FROM agg
    RETURNING id
  )
  SELECT COUNT(*) INTO v_rollup_rows FROM ins;

  -- 5) Atualiza totais do snapshot.
  UPDATE public.financeiro_snapshots
  SET total_titulos = v_total_titulos,
      total_rateios = v_total_rateios,
      total_valor = v_total_valor,
      titulos_sem_obra = v_sem_obra,
      novos_sem_natureza = v_pendentes
  WHERE id = v_snapshot_id;

  -- 6) Purge dos snapshots brutos (teto 12). O rollup NÃO é apagado
  -- porque a FK usa ON DELETE SET NULL.
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
    FROM public.financeiro_snapshots
  ), deleted AS (
    DELETE FROM public.financeiro_snapshots
    WHERE id IN (SELECT id FROM ranked WHERE rn > 12)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_purged FROM deleted;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'data_snapshot', v_data_snapshot,
    'matriz_atualizada_em', v_matriz_atualizada_em,
    'total_titulos', v_total_titulos,
    'total_rateios', v_total_rateios,
    'total_valor', v_total_valor,
    'titulos_sem_obra', v_sem_obra,
    'novos_sem_natureza', v_pendentes,
    'rollup_linhas', v_rollup_rows,
    'snapshots_purgados', v_purged
  );
END
$function$;
