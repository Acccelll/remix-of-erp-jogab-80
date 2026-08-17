
ALTER TABLE public.financeiro_snapshots
  ADD COLUMN IF NOT EXISTS novos_sem_natureza integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matriz_atualizada_em timestamptz;

CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(
  p_periodo_ref text,
  p_nome_titulos text,
  p_lancamentos jsonb
) RETURNS jsonb
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

  -- Deriva rateios a partir da matriz previamente carregada
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
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento::text
    WHERE l.snapshot_id = v_snapshot_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_total_rateios FROM ins;

  -- Títulos que ficaram sem rateio na matriz
  SELECT COUNT(*) INTO v_novos_sem_natureza
  FROM public.financeiro_lancamentos l
  WHERE l.snapshot_id = v_snapshot_id
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_rateios r WHERE r.lancamento_id = l.id
    );

  SELECT MAX(atualizado_em) INTO v_matriz_em FROM public.financeiro_matriz_rateios;

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
    'snapshots_purgados', v_purged,
    'matriz_atualizada_em', v_matriz_em
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_relatorio_totvs(text, text, jsonb) TO authenticated, service_role;
