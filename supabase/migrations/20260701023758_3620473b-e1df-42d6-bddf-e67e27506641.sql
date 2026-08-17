-- Fase 2 / Onda C: decomposição das RPCs monolíticas financeiras mantendo contrato público.

CREATE OR REPLACE FUNCTION public._fin_snapshot_criar_totvs(
  p_periodo_ref text,
  p_nome_titulos text
)
RETURNS TABLE(snapshot_id uuid, matriz_atualizada_em timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SELECT MAX(atualizado_em)
    INTO matriz_atualizada_em
  FROM public.financeiro_matriz_rateios;

  INSERT INTO public.financeiro_snapshots (
    periodo_ref,
    nome_arquivo_titulos,
    matriz_atualizada_em
  )
  VALUES (p_periodo_ref, p_nome_titulos, matriz_atualizada_em)
  RETURNING id INTO snapshot_id;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_criar_legacy(
  p_periodo_ref text,
  p_nome_titulos text,
  p_nome_rateios text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot_id uuid;
BEGIN
  INSERT INTO public.financeiro_snapshots (
    periodo_ref,
    nome_arquivo_titulos,
    nome_arquivo_rateios
  )
  VALUES (p_periodo_ref, p_nome_titulos, p_nome_rateios)
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_importar_lancamentos(
  p_snapshot_id uuid,
  p_lancamentos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_titulos int := 0;
  v_total_valor numeric := 0;
  v_sem_obra int := 0;
  v_titulos_obra int := 0;
  v_titulos_indireto int := 0;
  v_titulos_nc int := 0;
BEGIN
  WITH src AS (
    SELECT
      (e->>'ref_lancamento')::bigint AS ref_lancamento,
      NULLIF(e->>'filial','')::int AS filial,
      e->>'centro_custo' AS centro_custo,
      e->>'desc_centro_custo' AS desc_centro_custo,
      NULLIF(e->>'natureza_tipo','')::smallint AS natureza_tipo,
      NULLIF(e->>'status_cod','')::smallint AS status_cod,
      e->>'status_label' AS status_label,
      e->>'tipo_documento' AS tipo_documento,
      e->>'numero_documento' AS numero_documento,
      e->>'cnpj_cpf' AS cnpj_cpf,
      e->>'nome' AS nome,
      e->>'nome_fantasia' AS nome_fantasia,
      e->>'cliente_fornecedor' AS cliente_fornecedor,
      COALESCE((e->>'valor_original')::numeric, 0) AS valor_original,
      COALESCE((e->>'valor_desconto')::numeric, 0) AS valor_desconto,
      COALESCE((e->>'valor_liquido')::numeric, 0) AS valor_liquido,
      COALESCE((e->>'valor_baixado')::numeric, 0) AS valor_baixado,
      NULLIF(e->>'data_emissao','')::date AS data_emissao,
      NULLIF(e->>'data_vencimento','')::date AS data_vencimento,
      NULLIF(e->>'data_baixa','')::date AS data_baixa,
      NULLIF(e->>'data_pagamento','')::date AS data_pagamento,
      NULLIF(e->>'dias_atraso','')::int AS dias_atraso,
      NULLIF(e->>'mes_competencia','')::date AS mes_competencia,
      e->>'historico' AS historico
    FROM jsonb_array_elements(COALESCE(p_lancamentos, '[]'::jsonb)) AS e
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
    SELECT
      p_snapshot_id,
      s.ref_lancamento,
      s.filial,
      s.centro_custo,
      s.desc_centro_custo,
      cct.obra_id,
      s.natureza_tipo,
      s.status_cod,
      s.status_label,
      s.tipo_documento,
      s.numero_documento,
      s.cnpj_cpf,
      s.nome,
      s.nome_fantasia,
      s.cliente_fornecedor,
      s.valor_original,
      s.valor_desconto,
      s.valor_liquido,
      s.valor_baixado,
      s.data_emissao,
      s.data_vencimento,
      s.data_baixa,
      s.data_pagamento,
      s.dias_atraso,
      s.mes_competencia,
      s.historico,
      COALESCE(cct.tipo, 'nao_classificado'),
      cct.categoria,
      'totvs'
    FROM src s
    LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = s.centro_custo
    RETURNING id, obra_id, valor_liquido, centro_custo_tipo
  )
  SELECT
    COUNT(*),
    COALESCE(SUM(valor_liquido), 0),
    COUNT(*) FILTER (WHERE obra_id IS NULL),
    COUNT(*) FILTER (WHERE centro_custo_tipo = 'obra'),
    COUNT(*) FILTER (WHERE centro_custo_tipo = 'indireto'),
    COUNT(*) FILTER (WHERE centro_custo_tipo = 'nao_classificado')
  INTO v_total_titulos, v_total_valor, v_sem_obra, v_titulos_obra, v_titulos_indireto, v_titulos_nc
  FROM inseridos;

  RETURN jsonb_build_object(
    'total_titulos', v_total_titulos,
    'total_valor', v_total_valor,
    'titulos_sem_obra', v_sem_obra,
    'titulos_obra', v_titulos_obra,
    'titulos_indireto', v_titulos_indireto,
    'titulos_nao_classificados', v_titulos_nc
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_importar_rateios_payload(
  p_snapshot_id uuid,
  p_rateios jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_rateios int := 0;
BEGIN
  WITH src AS (
    SELECT
      (e->>'ref_lancamento')::bigint AS ref_lancamento,
      e->>'cod_natureza' AS cod_natureza,
      e->>'desc_natureza' AS desc_natureza,
      e->>'status_lancamento' AS status_lancamento,
      COALESCE((e->>'valor_rateio')::numeric, 0) AS valor_rateio
    FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
    WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL
  ),
  inseridos AS (
    INSERT INTO public.financeiro_rateios (
      lancamento_id,
      cod_natureza,
      desc_natureza,
      grupo,
      subgrupo,
      valor_rateio,
      status_lancamento
    )
    SELECT
      l.id,
      s.cod_natureza,
      s.desc_natureza,
      split_part(s.cod_natureza, '.', 1),
      CASE
        WHEN s.cod_natureza ~ '^[0-9]+\.[0-9]+'
          THEN split_part(s.cod_natureza, '.', 1) || '.' || split_part(s.cod_natureza, '.', 2)
        ELSE NULL
      END,
      s.valor_rateio,
      s.status_lancamento
    FROM src s
    JOIN public.financeiro_lancamentos l
      ON l.snapshot_id = p_snapshot_id
     AND l.ref_lancamento = s.ref_lancamento
    RETURNING id
  )
  SELECT COUNT(*) INTO v_total_rateios FROM inseridos;

  RETURN v_total_rateios;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_importar_rateios_matriz(
  p_snapshot_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_rateios int := 0;
BEGIN
  WITH inseridos AS (
    INSERT INTO public.financeiro_rateios (
      lancamento_id,
      cod_natureza,
      desc_natureza,
      grupo,
      subgrupo,
      valor_rateio,
      status_lancamento
    )
    SELECT
      l.id,
      m.cod_natureza,
      m.desc_natureza,
      m.grupo,
      m.subgrupo,
      m.valor_rateio,
      l.status_label
    FROM public.financeiro_lancamentos l
    JOIN public.financeiro_matriz_rateios m ON m.ref_lancamento = l.ref_lancamento
    WHERE l.snapshot_id = p_snapshot_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_total_rateios FROM inseridos;

  RETURN v_total_rateios;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_marcar_pendentes_matriz(
  p_snapshot_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pendentes int := 0;
BEGIN
  WITH atualizados AS (
    UPDATE public.financeiro_lancamentos l
       SET pendente_natureza = true
     WHERE l.snapshot_id = p_snapshot_id
       AND NOT EXISTS (
         SELECT 1
           FROM public.financeiro_matriz_rateios m
          WHERE m.ref_lancamento = l.ref_lancamento
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_pendentes FROM atualizados;

  RETURN v_pendentes;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_popular_rollup(
  p_snapshot_id uuid,
  p_data_snapshot date
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rollup_rows int := 0;
BEGIN
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
    WHERE l.snapshot_id = p_snapshot_id
      AND COALESCE(l.status_cod, 0) <> 18
  ),
  normalizado AS (
    SELECT
      f.*,
      SUM(f.valor_rateio) OVER (PARTITION BY f.ref_lancamento) AS soma_rateios,
      CASE
        WHEN f.status_cod = 3 THEN 1::numeric
        WHEN COALESCE(f.titulo_valor_liquido, 0) = 0 THEN 0::numeric
        ELSE LEAST(1::numeric, GREATEST(0::numeric,
          f.titulo_valor_baixado / NULLIF(f.titulo_valor_liquido, 0)))
      END AS ratio_pago
    FROM fatias f
  ),
  calc AS (
    SELECT
      n.*,
      CASE
        WHEN COALESCE(n.soma_rateios, 0) = 0 THEN 0::numeric
        ELSE n.valor_rateio / n.soma_rateios
      END AS peso_fatia
    FROM normalizado n
  ),
  agrupado AS (
    SELECT
      p_data_snapshot AS data_snapshot,
      fatia_obra_id AS obra_id,
      status_cod,
      MAX(status_label) AS status_label,
      grupo,
      cod_natureza,
      MAX(desc_natureza) AS desc_natureza,
      ROUND(SUM(titulo_valor_liquido * peso_fatia * (1 - ratio_pago))::numeric, 2) AS valor_aberto,
      ROUND(SUM(titulo_valor_liquido * peso_fatia * ratio_pago)::numeric, 2) AS valor_pago,
      COUNT(DISTINCT ref_lancamento) AS qtd_titulos
    FROM calc
    GROUP BY fatia_obra_id, status_cod, grupo, cod_natureza
  ),
  inseridos AS (
    INSERT INTO public.financeiro_evolucao_rollup (
      snapshot_id,
      data_snapshot,
      obra_id,
      status_cod,
      status_label,
      grupo,
      cod_natureza,
      desc_natureza,
      valor_aberto,
      valor_pago,
      qtd_titulos
    )
    SELECT
      p_snapshot_id,
      data_snapshot,
      obra_id,
      status_cod,
      status_label,
      grupo,
      cod_natureza,
      desc_natureza,
      valor_aberto,
      valor_pago,
      qtd_titulos
    FROM agrupado
    RETURNING id
  )
  SELECT COUNT(*) INTO v_rollup_rows FROM inseridos;

  RETURN v_rollup_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_snapshot_purgar_antigos(
  p_manter int DEFAULT 12
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_purgados int := 0;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
      FROM public.financeiro_snapshots
  ), removidos AS (
    DELETE FROM public.financeiro_snapshots
     WHERE id IN (SELECT id FROM ranked WHERE rn > p_manter)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_purgados FROM removidos;

  RETURN v_purgados;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_matriz_preparar_stage(
  p_rateios jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DROP TABLE IF EXISTS pg_temp._fin_matriz_src;
  DROP TABLE IF EXISTS pg_temp._fin_matriz_src_uniq;

  CREATE TEMP TABLE _fin_matriz_src ON COMMIT DROP AS
  SELECT
    (e->>'ref_lancamento')::bigint AS ref_lancamento,
    NULLIF(e->>'cod_natureza','') AS cod_natureza,
    NULLIF(e->>'desc_natureza','') AS desc_natureza,
    COALESCE(NULLIF(e->>'grupo',''), split_part(NULLIF(e->>'cod_natureza',''), '.', 1)) AS grupo,
    COALESCE(
      NULLIF(e->>'subgrupo',''),
      CASE
        WHEN NULLIF(e->>'cod_natureza','') ~ '^[0-9]+\.[0-9]+'
          THEN split_part(e->>'cod_natureza', '.', 1) || '.' || split_part(e->>'cod_natureza', '.', 2)
        ELSE split_part(NULLIF(e->>'cod_natureza',''), '.', 1)
      END
    ) AS subgrupo,
    NULLIF(e->>'cod_ccusto','') AS cod_ccusto,
    NULLIF(e->>'desc_ccusto','') AS desc_ccusto,
    COALESCE((e->>'valor_rateio')::numeric, 0) AS valor_rateio,
    COALESCE((e->>'valor_original')::numeric, 0) AS valor_original,
    NULLIF(e->>'situacao_presumida','') AS situacao_presumida
  FROM jsonb_array_elements(COALESCE(p_rateios, '[]'::jsonb)) AS e
  WHERE NULLIF(e->>'ref_lancamento','') IS NOT NULL;

  CREATE TEMP TABLE _fin_matriz_src_uniq ON COMMIT DROP AS
  SELECT DISTINCT ON (ref_lancamento, COALESCE(cod_natureza, ''), COALESCE(cod_ccusto, ''))
    *
  FROM _fin_matriz_src
  ORDER BY ref_lancamento, COALESCE(cod_natureza, ''), COALESCE(cod_ccusto, ''), valor_rateio DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_matriz_contar_stage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int := 0;
  v_titulos int := 0;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT ref_lancamento)
    INTO v_total, v_titulos
  FROM _fin_matriz_src;

  RETURN jsonb_build_object(
    'total_rateios', v_total,
    'titulos_distintos', v_titulos
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_matriz_calcular_delta()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_novos int := 0;
  v_alterados int := 0;
  v_inalterados int := 0;
BEGIN
  WITH joined AS (
    SELECT
      s.*,
      m.cod_natureza AS m_cod_natureza,
      m.desc_natureza AS m_desc_natureza,
      m.grupo AS m_grupo,
      m.subgrupo AS m_subgrupo,
      m.desc_ccusto AS m_desc_ccusto,
      m.valor_rateio AS m_valor_rateio,
      m.valor_original AS m_valor_original,
      m.situacao_presumida AS m_situacao_presumida,
      m.id IS NULL AS is_new
    FROM _fin_matriz_src_uniq s
    LEFT JOIN public.financeiro_matriz_rateios m
      ON m.ref_lancamento = s.ref_lancamento
     AND COALESCE(m.cod_natureza, '') = COALESCE(s.cod_natureza, '')
     AND COALESCE(m.cod_ccusto, '') = COALESCE(s.cod_ccusto, '')
  )
  SELECT
    COUNT(*) FILTER (WHERE is_new),
    COUNT(*) FILTER (WHERE NOT is_new AND (
         COALESCE(desc_natureza, '')      IS DISTINCT FROM COALESCE(m_desc_natureza, '')
      OR COALESCE(grupo, '')              IS DISTINCT FROM COALESCE(m_grupo, '')
      OR COALESCE(subgrupo, '')           IS DISTINCT FROM COALESCE(m_subgrupo, '')
      OR COALESCE(desc_ccusto, '')        IS DISTINCT FROM COALESCE(m_desc_ccusto, '')
      OR valor_rateio                     IS DISTINCT FROM m_valor_rateio
      OR valor_original                   IS DISTINCT FROM m_valor_original
      OR COALESCE(situacao_presumida, '') IS DISTINCT FROM COALESCE(m_situacao_presumida, '')
    )),
    COUNT(*) FILTER (WHERE NOT is_new AND NOT (
         COALESCE(desc_natureza, '')      IS DISTINCT FROM COALESCE(m_desc_natureza, '')
      OR COALESCE(grupo, '')              IS DISTINCT FROM COALESCE(m_grupo, '')
      OR COALESCE(subgrupo, '')           IS DISTINCT FROM COALESCE(m_subgrupo, '')
      OR COALESCE(desc_ccusto, '')        IS DISTINCT FROM COALESCE(m_desc_ccusto, '')
      OR valor_rateio                     IS DISTINCT FROM m_valor_rateio
      OR valor_original                   IS DISTINCT FROM m_valor_original
      OR COALESCE(situacao_presumida, '') IS DISTINCT FROM COALESCE(m_situacao_presumida, '')
    ))
  INTO v_novos, v_alterados, v_inalterados
  FROM joined;

  RETURN jsonb_build_object(
    'novos', v_novos,
    'alterados', v_alterados,
    'inalterados', v_inalterados
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_matriz_remover_ausentes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_removidos int := 0;
BEGIN
  WITH removidos AS (
    DELETE FROM public.financeiro_matriz_rateios m
     WHERE NOT EXISTS (
       SELECT 1
         FROM _fin_matriz_src_uniq s
        WHERE s.ref_lancamento = m.ref_lancamento
          AND COALESCE(s.cod_natureza, '') = COALESCE(m.cod_natureza, '')
          AND COALESCE(s.cod_ccusto, '') = COALESCE(m.cod_ccusto, '')
     )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_removidos FROM removidos;

  RETURN v_removidos;
END;
$$;

CREATE OR REPLACE FUNCTION public._fin_matriz_upsert_stage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.financeiro_matriz_rateios AS m (
    ref_lancamento,
    cod_natureza,
    desc_natureza,
    grupo,
    subgrupo,
    cod_ccusto,
    desc_ccusto,
    valor_rateio,
    valor_original,
    situacao_presumida,
    atualizado_em
  )
  SELECT
    ref_lancamento,
    cod_natureza,
    desc_natureza,
    grupo,
    subgrupo,
    cod_ccusto,
    desc_ccusto,
    valor_rateio,
    valor_original,
    situacao_presumida,
    now()
  FROM _fin_matriz_src_uniq
  ON CONFLICT (ref_lancamento, COALESCE(cod_natureza, ''), COALESCE(cod_ccusto, ''))
  DO UPDATE SET
    desc_natureza = EXCLUDED.desc_natureza,
    grupo = EXCLUDED.grupo,
    subgrupo = EXCLUDED.subgrupo,
    desc_ccusto = EXCLUDED.desc_ccusto,
    valor_rateio = EXCLUDED.valor_rateio,
    valor_original = EXCLUDED.valor_original,
    situacao_presumida = EXCLUDED.situacao_presumida,
    atualizado_em = now()
  WHERE
       COALESCE(m.desc_natureza, '')      IS DISTINCT FROM COALESCE(EXCLUDED.desc_natureza, '')
    OR COALESCE(m.grupo, '')              IS DISTINCT FROM COALESCE(EXCLUDED.grupo, '')
    OR COALESCE(m.subgrupo, '')           IS DISTINCT FROM COALESCE(EXCLUDED.subgrupo, '')
    OR COALESCE(m.desc_ccusto, '')        IS DISTINCT FROM COALESCE(EXCLUDED.desc_ccusto, '')
    OR m.valor_rateio                     IS DISTINCT FROM EXCLUDED.valor_rateio
    OR m.valor_original                   IS DISTINCT FROM EXCLUDED.valor_original
    OR COALESCE(m.situacao_presumida, '') IS DISTINCT FROM COALESCE(EXCLUDED.situacao_presumida, '');
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_importar_matriz_impl(p_rateios jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_counts jsonb;
  v_delta jsonb;
  v_removidos int := 0;
BEGIN
  PERFORM public._fin_matriz_preparar_stage(p_rateios);
  v_counts := public._fin_matriz_contar_stage();
  v_delta := public._fin_matriz_calcular_delta();
  v_removidos := public._fin_matriz_remover_ausentes();
  PERFORM public._fin_matriz_upsert_stage();

  RETURN jsonb_build_object(
    'total_rateios', COALESCE((v_counts->>'total_rateios')::int, 0),
    'titulos_distintos', COALESCE((v_counts->>'titulos_distintos')::int, 0),
    'novos', COALESCE((v_delta->>'novos')::int, 0),
    'alterados', COALESCE((v_delta->>'alterados')::int, 0),
    'removidos', v_removidos,
    'inalterados', COALESCE((v_delta->>'inalterados')::int, 0),
    'atualizado_em', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_importar_financeiro_snapshot_impl(
  p_periodo_ref text,
  p_nome_titulos text,
  p_nome_rateios text,
  p_lancamentos jsonb,
  p_rateios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot_id uuid;
  v_lancamentos jsonb;
  v_total_rateios int := 0;
  v_purgados int := 0;
BEGIN
  v_snapshot_id := public._fin_snapshot_criar_legacy(p_periodo_ref, p_nome_titulos, p_nome_rateios);
  v_lancamentos := public._fin_snapshot_importar_lancamentos(v_snapshot_id, p_lancamentos);
  v_total_rateios := public._fin_snapshot_importar_rateios_payload(v_snapshot_id, p_rateios);

  UPDATE public.financeiro_snapshots
     SET total_titulos = COALESCE((v_lancamentos->>'total_titulos')::int, 0),
         total_rateios = v_total_rateios,
         total_valor = COALESCE((v_lancamentos->>'total_valor')::numeric, 0),
         titulos_sem_obra = COALESCE((v_lancamentos->>'titulos_sem_obra')::int, 0)
   WHERE id = v_snapshot_id;

  v_purgados := public._fin_snapshot_purgar_antigos(12);

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'total_titulos', COALESCE((v_lancamentos->>'total_titulos')::int, 0),
    'total_rateios', v_total_rateios,
    'total_valor', COALESCE((v_lancamentos->>'total_valor')::numeric, 0),
    'titulos_sem_obra', COALESCE((v_lancamentos->>'titulos_sem_obra')::int, 0),
    'snapshots_purgados', v_purgados
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs_impl(
  p_periodo_ref text,
  p_nome_titulos text,
  p_lancamentos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_snapshot_id uuid;
  v_data_snapshot date := CURRENT_DATE;
  v_matriz_atualizada_em timestamptz;
  v_lancamentos jsonb;
  v_total_rateios int := 0;
  v_pendentes int := 0;
  v_rollup_rows int := 0;
  v_purgados int := 0;
BEGIN
  SELECT s.snapshot_id, s.matriz_atualizada_em
    INTO v_snapshot_id, v_matriz_atualizada_em
  FROM public._fin_snapshot_criar_totvs(p_periodo_ref, p_nome_titulos) s;

  v_lancamentos := public._fin_snapshot_importar_lancamentos(v_snapshot_id, p_lancamentos);
  v_total_rateios := public._fin_snapshot_importar_rateios_matriz(v_snapshot_id);
  v_pendentes := public._fin_snapshot_marcar_pendentes_matriz(v_snapshot_id);
  v_rollup_rows := public._fin_snapshot_popular_rollup(v_snapshot_id, v_data_snapshot);

  UPDATE public.financeiro_snapshots
     SET total_titulos = COALESCE((v_lancamentos->>'total_titulos')::int, 0),
         total_rateios = v_total_rateios,
         total_valor = COALESCE((v_lancamentos->>'total_valor')::numeric, 0),
         titulos_sem_obra = COALESCE((v_lancamentos->>'titulos_sem_obra')::int, 0),
         novos_sem_natureza = v_pendentes
   WHERE id = v_snapshot_id;

  v_purgados := public._fin_snapshot_purgar_antigos(12);

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'data_snapshot', v_data_snapshot,
    'matriz_atualizada_em', v_matriz_atualizada_em,
    'total_titulos', COALESCE((v_lancamentos->>'total_titulos')::int, 0),
    'total_rateios', v_total_rateios,
    'total_valor', COALESCE((v_lancamentos->>'total_valor')::numeric, 0),
    'titulos_sem_obra', COALESCE((v_lancamentos->>'titulos_sem_obra')::int, 0),
    'novos_sem_natureza', v_pendentes,
    'rollup_linhas', v_rollup_rows,
    'snapshots_purgados', v_purgados
  );
END;
$$;

REVOKE ALL ON FUNCTION public._fin_snapshot_criar_totvs(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_criar_legacy(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_importar_lancamentos(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_importar_rateios_payload(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_importar_rateios_matriz(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_marcar_pendentes_matriz(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_popular_rollup(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_snapshot_purgar_antigos(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_matriz_preparar_stage(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_matriz_contar_stage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_matriz_calcular_delta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_matriz_remover_ausentes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fin_matriz_upsert_stage() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public._fin_snapshot_criar_totvs(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_criar_legacy(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_importar_lancamentos(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_importar_rateios_payload(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_importar_rateios_matriz(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_marcar_pendentes_matriz(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_popular_rollup(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_snapshot_purgar_antigos(int) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_matriz_preparar_stage(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_matriz_contar_stage() TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_matriz_calcular_delta() TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_matriz_remover_ausentes() TO service_role;
GRANT EXECUTE ON FUNCTION public._fin_matriz_upsert_stage() TO service_role;