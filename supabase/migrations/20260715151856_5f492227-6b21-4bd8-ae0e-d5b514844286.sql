
-- 1) Novos campos em snapshots
ALTER TABLE public.financeiro_snapshots
  ADD COLUMN IF NOT EXISTS hash_arquivo text,
  ADD COLUMN IF NOT EXISTS importado_por uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_financeiro_snapshots_hash
  ON public.financeiro_snapshots (hash_arquivo)
  WHERE hash_arquivo IS NOT NULL;

-- 2) Índice único no histórico de status TOTVS (evita duplicação em reimport idêntico)
CREATE UNIQUE INDEX IF NOT EXISTS ux_fin_rel_status_hist_unico
  ON public.financeiro_relatorio_status_historico (
    ref_lancamento, periodo_ref, nome_arquivo,
    COALESCE(status_cod, -1),
    COALESCE(valor_baixado, 0)
  );

-- 3) fn_importar_matriz — advisory lock + reconstruir só snapshot ativo
CREATE OR REPLACE FUNCTION public.fn_importar_matriz(p_rateios jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT := 0;
  v_titulos INT := 0;
  v_removidos INT := 0;
  v_reprocessados INT := 0;
  v_snapshot_ativo UUID;
BEGIN
  -- Advisory lock: chave arbitrária estável para a "importação Matriz".
  IF NOT pg_try_advisory_xact_lock(hashtext('financeiro.importar_matriz')) THEN
    RAISE EXCEPTION 'Outra importação de Matriz está em andamento. Aguarde alguns segundos e tente novamente.'
      USING ERRCODE = '55P03';
  END IF;

  CREATE TEMP TABLE _src ON COMMIT DROP AS
  SELECT
    (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
    NULLIF(e->>'cod_natureza','') AS cod_natureza,
    NULLIF(e->>'desc_natureza','') AS desc_natureza,
    COALESCE(NULLIF(e->>'grupo',''), split_part(NULLIF(e->>'cod_natureza',''), '.', 1)) AS grupo,
    COALESCE(
      NULLIF(e->>'subgrupo',''),
      CASE
        WHEN NULLIF(e->>'cod_natureza','') ~ '^[0-9]+\.[0-9]+'
          THEN split_part(e->>'cod_natureza','.',1)||'.'||split_part(e->>'cod_natureza','.',2)
        ELSE split_part(NULLIF(e->>'cod_natureza',''), '.', 1)
      END
    ) AS subgrupo,
    NULLIF(e->>'cod_ccusto','') AS cod_ccusto,
    NULLIF(e->>'desc_ccusto','') AS desc_ccusto,
    COALESCE((e->>'valor_rateio')::NUMERIC, 0) AS valor_rateio,
    COALESCE((e->>'valor_original')::NUMERIC, 0) AS valor_original,
    NULLIF(e->>'situacao_presumida','') AS situacao_presumida,
    NULLIF(e->>'data_emissao','')::DATE AS data_emissao,
    NULLIF(e->>'data_vencimento','')::DATE AS data_vencimento,
    NULLIF(e->>'natureza_tipo_matriz','')::SMALLINT AS natureza_tipo_matriz
  FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
  WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL;

  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento) INTO v_total, v_titulos FROM _src;

  CREATE TEMP TABLE _src_uniq ON COMMIT DROP AS
  SELECT DISTINCT ON (ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''))
    *
  FROM _src
  ORDER BY ref_lancamento, COALESCE(cod_natureza,''), COALESCE(cod_ccusto,''), valor_rateio DESC;

  WITH del AS (
    DELETE FROM public.financeiro_matriz_rateios m
    WHERE NOT EXISTS (
      SELECT 1 FROM _src_uniq s
      WHERE s.ref_lancamento = m.ref_lancamento
        AND COALESCE(s.cod_natureza,'') = COALESCE(m.cod_natureza,'')
        AND COALESCE(s.cod_ccusto,'')   = COALESCE(m.cod_ccusto,'')
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_removidos FROM del;

  INSERT INTO public.financeiro_matriz_rateios AS m (
    ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    data_emissao, data_vencimento, natureza_tipo_matriz, atualizado_em
  )
  SELECT ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original, situacao_presumida,
    data_emissao, data_vencimento, natureza_tipo_matriz, now()
  FROM _src_uniq
  ON CONFLICT (ref_lancamento, COALESCE(cod_natureza, ''), COALESCE(cod_ccusto, ''))
  DO UPDATE SET
    desc_natureza = EXCLUDED.desc_natureza,
    grupo = EXCLUDED.grupo,
    subgrupo = EXCLUDED.subgrupo,
    desc_ccusto = EXCLUDED.desc_ccusto,
    valor_rateio = EXCLUDED.valor_rateio,
    valor_original = EXCLUDED.valor_original,
    situacao_presumida = EXCLUDED.situacao_presumida,
    data_emissao = EXCLUDED.data_emissao,
    data_vencimento = EXCLUDED.data_vencimento,
    natureza_tipo_matriz = EXCLUDED.natureza_tipo_matriz,
    atualizado_em = now()
  WHERE
       COALESCE(m.desc_natureza,'')      IS DISTINCT FROM COALESCE(EXCLUDED.desc_natureza,'')
    OR COALESCE(m.grupo,'')              IS DISTINCT FROM COALESCE(EXCLUDED.grupo,'')
    OR COALESCE(m.subgrupo,'')           IS DISTINCT FROM COALESCE(EXCLUDED.subgrupo,'')
    OR COALESCE(m.desc_ccusto,'')        IS DISTINCT FROM COALESCE(EXCLUDED.desc_ccusto,'')
    OR m.valor_rateio                    IS DISTINCT FROM EXCLUDED.valor_rateio
    OR m.valor_original                  IS DISTINCT FROM EXCLUDED.valor_original
    OR COALESCE(m.situacao_presumida,'') IS DISTINCT FROM COALESCE(EXCLUDED.situacao_presumida,'')
    OR m.data_emissao                    IS DISTINCT FROM EXCLUDED.data_emissao
    OR m.data_vencimento                 IS DISTINCT FROM EXCLUDED.data_vencimento
    OR m.natureza_tipo_matriz            IS DISTINCT FROM EXCLUDED.natureza_tipo_matriz;

  -- F7: reconstruir apenas o snapshot mais recente.
  SELECT id INTO v_snapshot_ativo
  FROM public.financeiro_snapshots
  ORDER BY importado_em DESC
  LIMIT 1;

  IF v_snapshot_ativo IS NOT NULL THEN
    PERFORM public.fn_reconstruir_snapshot_matriz_central(v_snapshot_ativo);
    v_reprocessados := 1;
  END IF;

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos,
    'removidos', v_removidos,
    'snapshots_reprocessados', v_reprocessados,
    'atualizado_em', now()
  );
END
$$;

-- 4) fn_importar_relatorio_totvs — advisory lock, hash dedupe, importado_por, log de purga
CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(
  p_periodo_ref text,
  p_nome_titulos text,
  p_lancamentos jsonb,
  p_hash_arquivo text DEFAULT NULL,
  p_importado_por uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot_id UUID;
  v_snapshot_existente UUID;
  v_result jsonb;
  v_purged INT := 0;
  v_novos INT := 0;
  v_alterados INT := 0;
  v_inalterados INT := 0;
  v_total_arquivo INT := 0;
  v_purged_ids UUID[];
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('financeiro.importar_relatorio_totvs')) THEN
    RAISE EXCEPTION 'Outra importação de Relatório TOTVS está em andamento. Aguarde alguns segundos e tente novamente.'
      USING ERRCODE = '55P03';
  END IF;

  -- Dedupe por hash: se este arquivo já foi importado, retorna metadados do snapshot existente.
  IF p_hash_arquivo IS NOT NULL AND p_hash_arquivo <> '' THEN
    SELECT id INTO v_snapshot_existente
    FROM public.financeiro_snapshots
    WHERE hash_arquivo = p_hash_arquivo
    LIMIT 1;

    IF v_snapshot_existente IS NOT NULL THEN
      RETURN jsonb_build_object(
        'snapshot_id', v_snapshot_existente,
        'duplicado', true,
        'mensagem', 'Este arquivo já foi importado anteriormente. Nenhuma alteração aplicada.',
        'total_titulos', 0,
        'total_rateios', 0,
        'titulos_sem_obra', 0,
        'novos_sem_natureza', 0,
        'snapshots_purgados', 0,
        'novos', 0,
        'alterados', 0,
        'inalterados', 0,
        'total_arquivo', 0
      );
    END IF;
  END IF;

  INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos, hash_arquivo, importado_por)
  VALUES (p_periodo_ref, p_nome_titulos, NULLIF(p_hash_arquivo, ''), p_importado_por)
  RETURNING id INTO v_snapshot_id;

  DROP TABLE IF EXISTS pg_temp._rel_dedup;
  CREATE TEMP TABLE _rel_dedup ON COMMIT DROP AS
  WITH src AS (
    SELECT (e->>'ref_lancamento')::BIGINT AS ref_lancamento,
      NULLIF(e->>'filial','')::INT AS filial,
      e->>'centro_custo' AS centro_custo,
      e->>'desc_centro_custo' AS desc_centro_custo,
      cct.obra_id,
      cct.tipo AS centro_custo_tipo,
      cct.categoria AS categoria_indireta,
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
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = e->>'centro_custo'
    WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL
  )
  SELECT DISTINCT ON (ref_lancamento) *
  FROM src
  ORDER BY ref_lancamento,
    CASE WHEN status_cod IS NOT NULL THEN 0 ELSE 1 END,
    data_emissao DESC NULLS LAST;

  SELECT COUNT(*) INTO v_total_arquivo FROM _rel_dedup;

  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
    obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
    cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
    valor_original, valor_desconto, valor_liquido, valor_baixado,
    data_emissao, data_vencimento, data_baixa, data_pagamento,
    dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta, origem,
    pendente_natureza
  )
  SELECT v_snapshot_id, d.ref_lancamento, d.filial, d.centro_custo, d.desc_centro_custo,
    d.obra_id, d.natureza_tipo, d.status_cod, d.status_label, d.tipo_documento, d.numero_documento,
    d.cnpj_cpf, d.nome, d.nome_fantasia, d.cliente_fornecedor,
    d.valor_original, d.valor_desconto, d.valor_liquido, d.valor_baixado,
    d.data_emissao, d.data_vencimento, d.data_baixa, d.data_pagamento,
    d.dias_atraso, d.mes_competencia, d.historico, COALESCE(d.centro_custo_tipo, 'nao_classificado'),
    d.categoria_indireta, 'totvs',
    NOT EXISTS (SELECT 1 FROM public.financeiro_matriz_rateios m WHERE m.ref_lancamento = d.ref_lancamento)
  FROM _rel_dedup d;

  DROP TABLE IF EXISTS pg_temp._rel_upserts;
  CREATE TEMP TABLE _rel_upserts ON COMMIT DROP AS
  WITH up AS (
    INSERT INTO public.financeiro_relatorio_status_atual AS r (
      ref_lancamento, filial, natureza_tipo, status_cod, status_label,
      tipo_documento, numero_documento, cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
      valor_original, valor_desconto, valor_liquido, valor_baixado,
      data_emissao, data_vencimento, data_baixa, data_pagamento,
      dias_atraso, mes_competencia, historico, centro_custo, desc_centro_custo,
      obra_id, centro_custo_tipo, categoria_indireta,
      ultimo_periodo_ref, ultimo_arquivo, atualizado_em
    )
    SELECT d.ref_lancamento, d.filial, d.natureza_tipo, d.status_cod, d.status_label,
      d.tipo_documento, d.numero_documento, d.cnpj_cpf, d.nome, d.nome_fantasia, d.cliente_fornecedor,
      d.valor_original, d.valor_desconto, d.valor_liquido, d.valor_baixado,
      d.data_emissao, d.data_vencimento, d.data_baixa, d.data_pagamento,
      d.dias_atraso, d.mes_competencia, d.historico, d.centro_custo, d.desc_centro_custo,
      d.obra_id, COALESCE(d.centro_custo_tipo, 'nao_classificado'), d.categoria_indireta,
      p_periodo_ref, p_nome_titulos, now()
    FROM _rel_dedup d
    ON CONFLICT (ref_lancamento) DO UPDATE SET
      filial              = EXCLUDED.filial,
      natureza_tipo       = COALESCE(EXCLUDED.natureza_tipo, r.natureza_tipo),
      status_cod          = EXCLUDED.status_cod,
      status_label        = EXCLUDED.status_label,
      tipo_documento      = EXCLUDED.tipo_documento,
      numero_documento    = EXCLUDED.numero_documento,
      cnpj_cpf            = EXCLUDED.cnpj_cpf,
      nome                = EXCLUDED.nome,
      nome_fantasia       = EXCLUDED.nome_fantasia,
      cliente_fornecedor  = EXCLUDED.cliente_fornecedor,
      valor_original      = EXCLUDED.valor_original,
      valor_desconto      = EXCLUDED.valor_desconto,
      valor_liquido       = EXCLUDED.valor_liquido,
      valor_baixado       = EXCLUDED.valor_baixado,
      data_emissao        = EXCLUDED.data_emissao,
      data_vencimento     = EXCLUDED.data_vencimento,
      data_baixa          = EXCLUDED.data_baixa,
      data_pagamento      = EXCLUDED.data_pagamento,
      dias_atraso         = EXCLUDED.dias_atraso,
      mes_competencia     = EXCLUDED.mes_competencia,
      historico           = EXCLUDED.historico,
      centro_custo        = EXCLUDED.centro_custo,
      desc_centro_custo   = EXCLUDED.desc_centro_custo,
      obra_id             = EXCLUDED.obra_id,
      centro_custo_tipo   = EXCLUDED.centro_custo_tipo,
      categoria_indireta  = EXCLUDED.categoria_indireta,
      ultimo_periodo_ref  = EXCLUDED.ultimo_periodo_ref,
      ultimo_arquivo      = EXCLUDED.ultimo_arquivo,
      atualizado_em       = now()
    WHERE
         r.status_cod        IS DISTINCT FROM EXCLUDED.status_cod
      OR r.valor_baixado     IS DISTINCT FROM EXCLUDED.valor_baixado
      OR r.valor_liquido     IS DISTINCT FROM EXCLUDED.valor_liquido
      OR r.data_baixa        IS DISTINCT FROM EXCLUDED.data_baixa
      OR r.data_pagamento    IS DISTINCT FROM EXCLUDED.data_pagamento
      OR r.dias_atraso       IS DISTINCT FROM EXCLUDED.dias_atraso
      OR r.mes_competencia   IS DISTINCT FROM EXCLUDED.mes_competencia
    RETURNING r.ref_lancamento, r.status_cod, r.status_label, r.valor_baixado,
              r.data_baixa, r.data_pagamento, (xmax = 0) AS inseriu
  )
  SELECT * FROM up;

  SELECT
    COUNT(*) FILTER (WHERE inseriu),
    COUNT(*) FILTER (WHERE NOT inseriu)
    INTO v_novos, v_alterados
  FROM _rel_upserts;

  v_inalterados := GREATEST(v_total_arquivo - v_novos - v_alterados, 0);

  -- Histórico apenas para linhas efetivamente inseridas/alteradas; índice único
  -- criado nesta migration bloqueia duplicidade em reimport idêntico.
  INSERT INTO public.financeiro_relatorio_status_historico
    (ref_lancamento, status_cod, status_label, valor_baixado, data_baixa, data_pagamento, periodo_ref, nome_arquivo)
  SELECT u.ref_lancamento, u.status_cod, u.status_label, u.valor_baixado,
    u.data_baixa, u.data_pagamento, p_periodo_ref, p_nome_titulos
  FROM _rel_upserts u
  ON CONFLICT DO NOTHING;

  v_result := public.fn_reconstruir_snapshot_matriz_central(v_snapshot_id);

  -- Retenção de 12 snapshots, com log de auditoria
  WITH ranked AS (
    SELECT id, nome_arquivo_titulos, periodo_ref, importado_em,
           ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
    FROM public.financeiro_snapshots
  ), deleted AS (
    DELETE FROM public.financeiro_snapshots
    WHERE id IN (SELECT id FROM ranked WHERE rn > 12)
    RETURNING id, nome_arquivo_titulos, periodo_ref, importado_em
  )
  SELECT COUNT(*), ARRAY_AGG(id) INTO v_purged, v_purged_ids FROM deleted;

  IF v_purged > 0 THEN
    INSERT INTO public.audit_logs (entidade, entidade_id, acao, after, user_id)
    SELECT 'financeiro_snapshots', unnest(v_purged_ids), 'delete',
           jsonb_build_object('motivo', 'retencao_12_snapshots', 'purgados_em', now()),
           p_importado_por;
  END IF;

  RETURN v_result || jsonb_build_object(
    'snapshots_purgados', v_purged,
    'novos', v_novos,
    'alterados', v_alterados,
    'inalterados', v_inalterados,
    'total_arquivo', v_total_arquivo,
    'duplicado', false
  );
END;
$$;
