CREATE OR REPLACE FUNCTION public.fn_importar_financeiro_snapshot(
  p_periodo_ref TEXT, p_nome_titulos TEXT, p_nome_rateios TEXT,
  p_lancamentos JSONB, p_rateios JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_snapshot_id UUID;
  v_total_titulos INT := 0; v_total_rateios INT := 0;
  v_total_valor NUMERIC := 0; v_sem_obra INT := 0;
  v_titulos_obra INT := 0; v_titulos_indireto INT := 0;
  v_titulos_nc INT := 0; v_purged INT := 0;
BEGIN
  INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos, nome_arquivo_rateios)
  VALUES (p_periodo_ref, p_nome_titulos, p_nome_rateios)
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
      e->>'nome' AS nome, e->>'nome_fantasia' AS nome_fantasia,
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
    FROM src s LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = s.centro_custo
    RETURNING id, obra_id, valor_liquido, centro_custo_tipo
  )
  SELECT COUNT(*), COALESCE(SUM(valor_liquido),0),
    COUNT(*) FILTER (WHERE obra_id IS NULL),
    COUNT(*) FILTER (WHERE centro_custo_tipo = 'obra'),
    COUNT(*) FILTER (WHERE centro_custo_tipo = 'indireto'),
    COUNT(*) FILTER (WHERE centro_custo_tipo = 'nao_classificado')
    INTO v_total_titulos, v_total_valor, v_sem_obra, v_titulos_obra, v_titulos_indireto, v_titulos_nc
  FROM inseridos;

  WITH src AS (
    SELECT (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
      e->>'cod_natureza' AS cod_natureza,
      e->>'desc_natureza' AS desc_natureza,
      e->>'status_lancamento' AS status_lancamento,
      COALESCE((e->>'valor_rateio')::NUMERIC,0) AS valor_rateio
    FROM jsonb_array_elements(COALESCE(p_rateios,'[]'::jsonb)) AS e
  ),
  inseridos AS (
    INSERT INTO public.financeiro_rateios (
      lancamento_id, cod_natureza, desc_natureza, grupo, subgrupo, valor_rateio, status_lancamento
    )
    SELECT l.id, s.cod_natureza, s.desc_natureza,
      split_part(s.cod_natureza,'.',1),
      CASE WHEN s.cod_natureza ~ '^[0-9]+\.[0-9]+'
        THEN split_part(s.cod_natureza,'.',1)||'.'||split_part(s.cod_natureza,'.',2)
        ELSE NULL END,
      s.valor_rateio, s.status_lancamento
    FROM src s JOIN public.financeiro_lancamentos l
      ON l.snapshot_id = v_snapshot_id AND l.ref_lancamento = s.ref_lancamento
    RETURNING id
  )
  SELECT COUNT(*) INTO v_total_rateios FROM inseridos;

  UPDATE public.financeiro_snapshots
  SET total_titulos = v_total_titulos, total_rateios = v_total_rateios,
      total_valor = v_total_valor, titulos_sem_obra = v_sem_obra
  WHERE id = v_snapshot_id;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
    FROM public.financeiro_snapshots
  ), deleted AS (
    DELETE FROM public.financeiro_snapshots WHERE id IN (SELECT id FROM ranked WHERE rn > 12) RETURNING id
  )
  SELECT COUNT(*) INTO v_purged FROM deleted;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id, 'total_titulos', v_total_titulos,
    'total_rateios', v_total_rateios, 'total_valor', v_total_valor,
    'titulos_sem_obra', v_sem_obra, 'snapshots_purgados', v_purged
  );
END $$;
GRANT EXECUTE ON FUNCTION public.fn_importar_financeiro_snapshot(TEXT,TEXT,TEXT,JSONB,JSONB) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.fn_lancamento_solicitacao_aprovada(
  p_solicitacao_id UUID, p_obra_id UUID, p_centro_custo TEXT,
  p_valor NUMERIC, p_data_prevista DATE, p_descricao TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_snap_id UUID; v_lanc_id UUID;
BEGIN
  SELECT id INTO v_snap_id FROM public.financeiro_snapshots ORDER BY importado_em DESC LIMIT 1;
  IF v_snap_id IS NULL THEN
    INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
    VALUES ('sistema', 'sistema') RETURNING id INTO v_snap_id;
  END IF;
  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, obra_id, centro_custo,
    valor_liquido, valor_original, data_vencimento,
    status_cod, status_label, historico, origem, solicitacao_id
  ) VALUES (
    v_snap_id, (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    p_obra_id, p_centro_custo, p_valor, p_valor, p_data_prevista,
    1, 'Compromisso (solicitação aprovada)',
    COALESCE(p_descricao, 'Solicitação aprovada'), 'sistema', p_solicitacao_id
  ) RETURNING id INTO v_lanc_id;
  RETURN v_lanc_id;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_lancamento_solicitacao_aprovada(UUID,UUID,TEXT,NUMERIC,DATE,TEXT) TO authenticated, anon;