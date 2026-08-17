
-- =========================================================================
-- Parte A — Tabelas de estado acumulado do Relatório de Status
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.financeiro_relatorio_status_atual (
  ref_lancamento BIGINT PRIMARY KEY,
  filial INT,
  natureza_tipo SMALLINT,
  status_cod SMALLINT,
  status_label TEXT,
  tipo_documento TEXT,
  numero_documento TEXT,
  cnpj_cpf TEXT,
  nome TEXT,
  nome_fantasia TEXT,
  cliente_fornecedor TEXT,
  valor_original NUMERIC NOT NULL DEFAULT 0,
  valor_desconto NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC NOT NULL DEFAULT 0,
  valor_baixado NUMERIC NOT NULL DEFAULT 0,
  data_emissao DATE,
  data_vencimento DATE,
  data_baixa DATE,
  data_pagamento DATE,
  dias_atraso INT,
  mes_competencia DATE,
  historico TEXT,
  centro_custo TEXT,
  desc_centro_custo TEXT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  centro_custo_tipo TEXT,
  categoria_indireta TEXT,
  ultimo_periodo_ref TEXT,
  ultimo_arquivo TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_relatorio_status_atual TO authenticated;
GRANT ALL ON public.financeiro_relatorio_status_atual TO service_role;

ALTER TABLE public.financeiro_relatorio_status_atual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_rel_status_atual select autenticado" ON public.financeiro_relatorio_status_atual;
CREATE POLICY "fin_rel_status_atual select autenticado"
  ON public.financeiro_relatorio_status_atual FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_fin_rel_status_atual_atualizado
  ON public.financeiro_relatorio_status_atual(atualizado_em DESC);

CREATE TABLE IF NOT EXISTS public.financeiro_relatorio_status_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_lancamento BIGINT NOT NULL,
  status_cod SMALLINT,
  status_label TEXT,
  valor_baixado NUMERIC,
  data_baixa DATE,
  data_pagamento DATE,
  periodo_ref TEXT,
  nome_arquivo TEXT,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.financeiro_relatorio_status_historico TO authenticated;
GRANT ALL ON public.financeiro_relatorio_status_historico TO service_role;

ALTER TABLE public.financeiro_relatorio_status_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fin_rel_hist select autenticado" ON public.financeiro_relatorio_status_historico;
CREATE POLICY "fin_rel_hist select autenticado"
  ON public.financeiro_relatorio_status_historico FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS fin_relatorio_hist_ref_idx
  ON public.financeiro_relatorio_status_historico(ref_lancamento, importado_em DESC);

-- =========================================================================
-- Parte F — Backfill a partir do último snapshot existente
-- =========================================================================
DO $$
DECLARE
  v_snap uuid;
BEGIN
  SELECT id INTO v_snap FROM public.financeiro_snapshots
  ORDER BY importado_em DESC LIMIT 1;

  IF v_snap IS NOT NULL THEN
    INSERT INTO public.financeiro_relatorio_status_atual (
      ref_lancamento, filial, natureza_tipo, status_cod, status_label,
      tipo_documento, numero_documento, cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
      valor_original, valor_desconto, valor_liquido, valor_baixado,
      data_emissao, data_vencimento, data_baixa, data_pagamento,
      dias_atraso, mes_competencia, historico, centro_custo, desc_centro_custo,
      obra_id, centro_custo_tipo, categoria_indireta,
      ultimo_periodo_ref, ultimo_arquivo, atualizado_em
    )
    SELECT DISTINCT ON (l.ref_lancamento)
      l.ref_lancamento, l.filial, l.natureza_tipo, l.status_cod, l.status_label,
      l.tipo_documento, l.numero_documento, l.cnpj_cpf, l.nome, l.nome_fantasia, l.cliente_fornecedor,
      l.valor_original, l.valor_desconto, l.valor_liquido, l.valor_baixado,
      l.data_emissao, l.data_vencimento, l.data_baixa, l.data_pagamento,
      l.dias_atraso, l.mes_competencia, l.historico, l.centro_custo, l.desc_centro_custo,
      l.obra_id, l.centro_custo_tipo, l.categoria_indireta,
      '[migração inicial — Prompt 3]', '[migração inicial — Prompt 3]', now()
    FROM public.financeiro_lancamentos l
    WHERE l.snapshot_id = v_snap
      AND l.origem = 'totvs'
    ORDER BY l.ref_lancamento,
      CASE WHEN l.status_cod IS NOT NULL THEN 0 ELSE 1 END,
      l.id
    ON CONFLICT (ref_lancamento) DO NOTHING;

    INSERT INTO public.financeiro_relatorio_status_historico
      (ref_lancamento, status_cod, status_label, valor_baixado, data_baixa, data_pagamento, periodo_ref, nome_arquivo)
    SELECT ref_lancamento, status_cod, status_label, valor_baixado, data_baixa, data_pagamento,
      '[migração inicial — Prompt 3]', '[migração inicial — Prompt 3]'
    FROM public.financeiro_relatorio_status_atual;
  END IF;
END $$;

-- =========================================================================
-- Parte B — fn_importar_relatorio_totvs: acumula + registra histórico
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(
  p_periodo_ref text,
  p_nome_titulos text,
  p_lancamentos jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot_id UUID;
  v_result jsonb;
  v_purged INT := 0;
  v_novos INT := 0;
  v_alterados INT := 0;
  v_inalterados INT := 0;
  v_total_arquivo INT := 0;
BEGIN
  INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
  VALUES (p_periodo_ref, p_nome_titulos)
  RETURNING id INTO v_snapshot_id;

  -- Fonte deduplicada por ref_lancamento (mesmo padrão da versão anterior)
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

  -- Mantém financeiro_lancamentos do snapshot atual (rollup histórico continua funcionando)
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

  -- Upsert no estado acumulado. RETURNING (xmax=0) diferencia INSERT (novo) de UPDATE.
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

  -- Histórico apenas para linhas que efetivamente entraram no upsert (novos + alterados)
  INSERT INTO public.financeiro_relatorio_status_historico
    (ref_lancamento, status_cod, status_label, valor_baixado, data_baixa, data_pagamento, periodo_ref, nome_arquivo)
  SELECT u.ref_lancamento, u.status_cod, u.status_label, u.valor_baixado,
    u.data_baixa, u.data_pagamento, p_periodo_ref, p_nome_titulos
  FROM _rel_upserts u;

  -- Reconstrução central (agora lê o estado acumulado, ver Parte C abaixo)
  v_result := public.fn_reconstruir_snapshot_matriz_central(v_snapshot_id);

  -- Retenção de snapshots (mantém 12)
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY importado_em DESC) AS rn
    FROM public.financeiro_snapshots
  ), deleted AS (
    DELETE FROM public.financeiro_snapshots WHERE id IN (SELECT id FROM ranked WHERE rn > 12) RETURNING id
  )
  SELECT COUNT(*) INTO v_purged FROM deleted;

  RETURN v_result || jsonb_build_object(
    'snapshots_purgados', v_purged,
    'novos', v_novos,
    'alterados', v_alterados,
    'inalterados', v_inalterados,
    'total_arquivo', v_total_arquivo
  );
END;
$function$;

-- =========================================================================
-- Parte C — fn_reconstruir_snapshot_matriz_central lê do estado acumulado
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_reconstruir_snapshot_matriz_central(p_snapshot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_snapshot date;
  v_total_titulos integer := 0;
  v_total_valor numeric := 0;
BEGIN
  SELECT importado_em::date INTO v_data_snapshot
  FROM public.financeiro_snapshots
  WHERE id = p_snapshot_id;

  IF v_data_snapshot IS NULL THEN
    RAISE EXCEPTION 'Snapshot financeiro não encontrado: %', p_snapshot_id;
  END IF;

  -- Origem agora é a tabela acumulada (não mais os lançamentos do snapshot atual)
  DROP TABLE IF EXISTS pg_temp._fin_status_src;
  CREATE TEMP TABLE _fin_status_src ON COMMIT DROP AS
  SELECT
    r.ref_lancamento,
    r.filial,
    r.natureza_tipo,
    r.status_cod,
    r.status_label,
    r.tipo_documento,
    r.numero_documento,
    r.cnpj_cpf,
    r.nome,
    r.nome_fantasia,
    r.cliente_fornecedor,
    r.valor_original,
    r.valor_desconto,
    r.valor_liquido,
    r.valor_baixado,
    r.data_emissao,
    r.data_vencimento,
    r.data_baixa,
    r.data_pagamento,
    r.dias_atraso,
    r.mes_competencia,
    r.historico,
    r.centro_custo,
    r.desc_centro_custo,
    r.obra_id,
    r.centro_custo_tipo,
    r.categoria_indireta
  FROM public.financeiro_relatorio_status_atual r;

  DELETE FROM public.financeiro_lancamentos
  WHERE snapshot_id = p_snapshot_id
    AND origem = 'totvs';

  DROP TABLE IF EXISTS pg_temp._matriz_base;
  CREATE TEMP TABLE _matriz_base ON COMMIT DROP AS
  SELECT
    m.ref_lancamento,
    SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0))::numeric AS valor_matriz,
    SUM(GREATEST(COALESCE(NULLIF(m.valor_original, 0), m.valor_rateio, 0), 0))::numeric AS valor_original_matriz,
    MIN(m.data_emissao) FILTER (WHERE m.data_emissao IS NOT NULL) AS data_emissao_matriz,
    MIN(m.data_vencimento) FILTER (WHERE m.data_vencimento IS NOT NULL) AS data_vencimento_matriz,
    MAX(m.natureza_tipo_matriz) FILTER (WHERE m.natureza_tipo_matriz IS NOT NULL) AS natureza_tipo_matriz,
    CASE
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%cancel%') THEN 'CANCELADO'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%venc%') THEN 'VENCIDO'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%aberto%') THEN 'EM ABERTO'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) LIKE '%parcial%') THEN 'BAIXA PARCIAL'
      WHEN bool_or(lower(coalesce(m.situacao_presumida, '')) IN ('baixa', 'baixado')) THEN 'BAIXA'
      ELSE NULL
    END AS situacao_matriz
  FROM public.financeiro_matriz_rateios m
  GROUP BY m.ref_lancamento;

  DROP TABLE IF EXISTS pg_temp._principal_cc;
  CREATE TEMP TABLE _principal_cc ON COMMIT DROP AS
  SELECT DISTINCT ON (m.ref_lancamento)
    m.ref_lancamento,
    m.cod_ccusto,
    m.desc_ccusto,
    cct.obra_id,
    cct.tipo,
    cct.categoria
  FROM public.financeiro_matriz_rateios m
  LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
  ORDER BY m.ref_lancamento, GREATEST(COALESCE(m.valor_rateio, 0), 0) DESC, m.cod_ccusto NULLS LAST;

  INSERT INTO public.financeiro_divergencias_matriz (ref_lancamento, campo, valor_matriz, valor_relatorio)
  SELECT mb.ref_lancamento, 'natureza_tipo', mb.natureza_tipo_matriz::text, s.natureza_tipo::text
  FROM _matriz_base mb
  JOIN _fin_status_src s ON s.ref_lancamento = mb.ref_lancamento
  WHERE mb.natureza_tipo_matriz IS NOT NULL
    AND s.natureza_tipo IS NOT NULL
    AND mb.natureza_tipo_matriz <> s.natureza_tipo
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_divergencias_matriz d
      WHERE d.ref_lancamento = mb.ref_lancamento
        AND d.campo = 'natureza_tipo'
        AND COALESCE(d.valor_matriz, '') = COALESCE(mb.natureza_tipo_matriz::text, '')
        AND COALESCE(d.valor_relatorio, '') = COALESCE(s.natureza_tipo::text, '')
    );

  INSERT INTO public.financeiro_divergencias_matriz (ref_lancamento, campo, valor_matriz, valor_relatorio)
  SELECT mb.ref_lancamento, 'status_cod',
    public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)::text,
    s.status_cod::text
  FROM _matriz_base mb
  JOIN _fin_status_src s ON s.ref_lancamento = mb.ref_lancamento
  WHERE s.status_cod IS NOT NULL
    AND s.status_cod IS DISTINCT FROM
        public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)
    AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_divergencias_matriz d
      WHERE d.ref_lancamento = mb.ref_lancamento
        AND d.campo = 'status_cod'
        AND COALESCE(d.valor_matriz, '') = COALESCE(
              public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)::text, '')
        AND COALESCE(d.valor_relatorio, '') = COALESCE(s.status_cod::text, '')
    );

  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, filial, centro_custo, desc_centro_custo,
    obra_id, natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
    cnpj_cpf, nome, nome_fantasia, cliente_fornecedor,
    valor_original, valor_desconto, valor_liquido, valor_baixado,
    data_emissao, data_vencimento, data_baixa, data_pagamento,
    dias_atraso, mes_competencia, historico, centro_custo_tipo, categoria_indireta,
    origem, pendente_natureza, mes_competencia_estimado, dias_atraso_estimado
  )
  SELECT
    p_snapshot_id,
    COALESCE(mb.ref_lancamento, s.ref_lancamento),
    s.filial,
    COALESCE(pc.cod_ccusto, s.centro_custo),
    COALESCE(pc.desc_ccusto, s.desc_centro_custo),
    COALESCE(pc.obra_id, s.obra_id),
    COALESCE(s.natureza_tipo, mb.natureza_tipo_matriz),
    COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)),
    COALESCE(s.status_label, public.fn_financeiro_status_label(public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot))),
    s.tipo_documento, s.numero_documento, s.cnpj_cpf, s.nome, s.nome_fantasia, s.cliente_fornecedor,
    COALESCE(NULLIF(mb.valor_original_matriz, 0), mb.valor_matriz, s.valor_original, 0),
    COALESCE(s.valor_desconto, 0),
    COALESCE(mb.valor_matriz, s.valor_liquido, 0),
    CASE
      WHEN COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)) = 3
        THEN COALESCE(mb.valor_matriz, s.valor_liquido, 0)
      WHEN COALESCE(s.status_cod, public.fn_financeiro_status_matriz(mb.situacao_matriz, mb.data_vencimento_matriz, v_data_snapshot)) = 15
        THEN LEAST(GREATEST(COALESCE(s.valor_baixado, 0), 0), COALESCE(mb.valor_matriz, s.valor_liquido, 0))
      ELSE 0
    END,
    COALESCE(mb.data_emissao_matriz, s.data_emissao),
    COALESCE(mb.data_vencimento_matriz, s.data_vencimento),
    s.data_baixa,
    s.data_pagamento,
    CASE
      WHEN COALESCE(mb.data_vencimento_matriz, s.data_vencimento) IS NULL THEN s.dias_atraso
      ELSE GREATEST((v_data_snapshot - COALESCE(mb.data_vencimento_matriz, s.data_vencimento)), 0)
    END,
    COALESCE(s.mes_competencia, date_trunc('month', COALESCE(mb.data_emissao_matriz, s.data_emissao, v_data_snapshot))::date),
    s.historico,
    COALESCE(pc.tipo, s.centro_custo_tipo, 'nao_classificado'),
    COALESCE(pc.categoria, s.categoria_indireta),
    'totvs',
    (mb.ref_lancamento IS NULL),
    (s.mes_competencia IS NULL),
    (s.dias_atraso IS NULL AND mb.data_vencimento_matriz IS NOT NULL)
  FROM _matriz_base mb
  FULL OUTER JOIN _fin_status_src s ON s.ref_lancamento = mb.ref_lancamento
  LEFT JOIN _principal_cc pc ON pc.ref_lancamento = mb.ref_lancamento;

  SELECT COUNT(*), COALESCE(SUM(valor_liquido), 0)
    INTO v_total_titulos, v_total_valor
  FROM public.financeiro_lancamentos
  WHERE snapshot_id = p_snapshot_id AND origem = 'totvs';

  UPDATE public.financeiro_snapshots
  SET total_titulos = v_total_titulos, total_valor = v_total_valor
  WHERE id = p_snapshot_id;

  RETURN jsonb_build_object(
    'snapshot_id', p_snapshot_id,
    'total_titulos', v_total_titulos,
    'total_valor', v_total_valor
  );
END
$function$;

-- =========================================================================
-- Parte D — vw_financeiro_obra ganha `sem_atualizacao_recente`
-- =========================================================================
DROP VIEW IF EXISTS public.vw_financeiro_obra;

CREATE VIEW public.vw_financeiro_obra
WITH (security_invoker = on)
AS
WITH ultimo AS (
  SELECT fs.id FROM public.financeiro_snapshots fs
  ORDER BY fs.importado_em DESC LIMIT 1
), base AS (
  SELECT
    l.*,
    m.id AS matriz_id,
    m.cod_natureza AS matriz_cod_natureza,
    m.desc_natureza AS matriz_desc_natureza,
    COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza, ''), '.', 1)) AS matriz_grupo,
    COALESCE(
      m.subgrupo,
      CASE
        WHEN m.cod_natureza ~ '^[0-9]+\.[0-9]+'
          THEN split_part(m.cod_natureza, '.', 1) || '.' || split_part(m.cod_natureza, '.', 2)
        ELSE NULL
      END
    ) AS matriz_subgrupo,
    m.cod_ccusto AS matriz_centro_custo,
    m.desc_ccusto AS matriz_desc_centro_custo,
    GREATEST(COALESCE(m.valor_rateio, 0), 0) AS matriz_valor_rateio,
    m.situacao_presumida AS matriz_status_lancamento,
    m.atualizado_em AS matriz_atualizado_em,
    r.atualizado_em AS relatorio_atualizado_em,
    cct.obra_id AS matriz_obra_id,
    cct.tipo AS matriz_centro_custo_tipo,
    cct.categoria AS matriz_categoria_indireta,
    SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0)) OVER (
      PARTITION BY l.id, COALESCE(m.cod_ccusto, l.centro_custo, '')
    ) AS valor_total_centro
  FROM public.financeiro_lancamentos l
  JOIN ultimo u ON u.id = l.snapshot_id
  LEFT JOIN public.financeiro_matriz_rateios m
    ON m.ref_lancamento = l.ref_lancamento
   AND COALESCE(l.pendente_natureza, false) = false
  LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
  LEFT JOIN public.financeiro_relatorio_status_atual r ON r.ref_lancamento = l.ref_lancamento
  WHERE l.origem = 'totvs'
), normalizado AS (
  SELECT
    b.*,
    CASE
      WHEN b.matriz_id IS NULL THEN b.id
      ELSE (
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 1, 8) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 9, 4) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 13, 4) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 17, 4) || '-' ||
        substr(md5(b.id::text || '|' || COALESCE(b.matriz_centro_custo, b.centro_custo, '')), 21, 12)
      )::uuid
    END AS lancamento_fatia_id,
    CASE
      WHEN b.matriz_id IS NULL THEN COALESCE(b.valor_liquido, 0)
      ELSE COALESCE(b.valor_total_centro, 0)
    END AS valor_liquido_fatia,
    CASE
      WHEN b.matriz_id IS NULL THEN COALESCE(b.valor_baixado, 0)
      WHEN b.status_cod = 3 THEN COALESCE(b.valor_total_centro, 0)
      WHEN b.status_cod = 15 AND COALESCE(b.valor_liquido, 0) > 0
        THEN LEAST(
          COALESCE(b.valor_total_centro, 0),
          ROUND(COALESCE(b.valor_baixado, 0) * COALESCE(b.valor_total_centro, 0) / NULLIF(b.valor_liquido, 0), 2)
        )
      ELSE 0
    END AS valor_baixado_fatia
  FROM base b
)
SELECT
  n.lancamento_fatia_id AS lancamento_id,
  COALESCE(n.matriz_obra_id, n.obra_id) AS obra_id,
  o.nome AS obra_nome,
  o.codigo AS obra_codigo,
  COALESCE(n.matriz_centro_custo, n.centro_custo) AS centro_custo,
  COALESCE(n.matriz_desc_centro_custo, n.desc_centro_custo) AS desc_centro_custo,
  n.ref_lancamento,
  COALESCE(
    n.natureza_tipo,
    CASE
      WHEN n.matriz_grupo = '1' THEN 1::smallint
      WHEN n.matriz_grupo IN ('2', '3') THEN 2::smallint
      ELSE NULL::smallint
    END
  ) AS natureza_tipo,
  n.status_cod,
  n.status_label,
  n.nome AS contraparte,
  n.cliente_fornecedor,
  n.valor_liquido_fatia AS valor_liquido,
  n.valor_baixado_fatia AS valor_baixado,
  n.data_emissao,
  n.data_vencimento,
  n.data_pagamento,
  n.mes_competencia,
  n.mes_competencia_estimado,
  n.dias_atraso_estimado,
  n.origem,
  n.matriz_cod_natureza AS cod_natureza,
  n.matriz_desc_natureza AS desc_natureza,
  n.matriz_grupo AS grupo,
  n.matriz_subgrupo AS subgrupo,
  CASE WHEN n.matriz_id IS NULL THEN COALESCE(n.valor_liquido, 0) ELSE n.matriz_valor_rateio END AS valor_rateio,
  n.matriz_status_lancamento AS status_lancamento,
  n.dias_atraso,
  COALESCE(n.matriz_centro_custo_tipo, n.centro_custo_tipo, 'nao_classificado') AS centro_custo_tipo,
  COALESCE(n.matriz_categoria_indireta, n.categoria_indireta) AS categoria_indireta,
  COALESCE(n.pendente_natureza, n.matriz_id IS NULL) AS pendente_natureza,
  GREATEST(n.relatorio_atualizado_em, n.matriz_atualizado_em) AS ultima_atualizacao,
  (
    COALESCE(GREATEST(n.relatorio_atualizado_em, n.matriz_atualizado_em), 'epoch'::timestamptz)
      < now() - INTERVAL '60 days'
  ) AS sem_atualizacao_recente
FROM normalizado n
LEFT JOIN public.obras o ON o.id = COALESCE(n.matriz_obra_id, n.obra_id);

GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;
