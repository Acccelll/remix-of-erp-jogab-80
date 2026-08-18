-- FIN-002 — Consolidação de leitura entre o legado/snapshot TOTVS e o núcleo
-- canônico de títulos do ERP.
--
-- Princípios:
--   1. mantém o contrato histórico de public.vw_financeiro_obra;
--   2. inclui financeiro_titulos/financeiro_titulo_rateios sem materializar cópias;
--   3. deduplica SOMENTE por identidade estável (origem_id ou origem_ref TOTVS exata);
--   4. traduz o status canônico para os códigos já consumidos pelo front;
--   5. executa como security_invoker para preservar RLS das tabelas-base;
--   6. acrescenta cnpj_cpf e historico, já solicitados pelo front mas ausentes
--      da versão anterior da view.

CREATE OR REPLACE VIEW public.vw_financeiro_obra
WITH (security_invoker = true)
AS
WITH ultimo AS (
  SELECT fs.id
  FROM public.financeiro_snapshots fs
  ORDER BY fs.importado_em DESC
  LIMIT 1
),
legacy_base AS (
  SELECT
    l.id,
    l.snapshot_id,
    l.ref_lancamento,
    l.filial,
    l.centro_custo,
    l.desc_centro_custo,
    l.obra_id,
    l.natureza_tipo,
    l.status_cod,
    l.status_label,
    l.tipo_documento,
    l.numero_documento,
    l.cnpj_cpf,
    l.nome,
    l.nome_fantasia,
    l.cliente_fornecedor,
    l.valor_original,
    l.valor_desconto,
    l.valor_liquido,
    l.valor_baixado,
    l.data_emissao,
    l.data_vencimento,
    l.data_baixa,
    l.data_pagamento,
    l.dias_atraso,
    l.mes_competencia,
    l.historico,
    l.centro_custo_tipo,
    l.categoria_indireta,
    l.origem,
    l.solicitacao_id,
    l.conciliado,
    l.pendente_natureza,
    l.mes_competencia_estimado,
    l.dias_atraso_estimado,
    m.id AS matriz_id,
    m.cod_natureza AS matriz_cod_natureza,
    m.desc_natureza AS matriz_desc_natureza,
    COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza, ''), '.', 1)) AS matriz_grupo,
    COALESCE(
      m.subgrupo,
      CASE
        WHEN m.cod_natureza ~ '^[0-9]+\.[0-9]+' THEN
          split_part(m.cod_natureza, '.', 1) || '.' || split_part(m.cod_natureza, '.', 2)
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
   AND l.origem = 'totvs'
  LEFT JOIN public.centros_custo_totvs cct
    ON cct.codigo = m.cod_ccusto
  LEFT JOIN public.financeiro_relatorio_status_atual r
    ON r.ref_lancamento = l.ref_lancamento
  WHERE l.origem IN ('totvs', 'sistema')
    AND l.superseded_by IS NULL
),
legacy_normalizado AS (
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
      WHEN b.status_cod = 15 AND COALESCE(b.valor_liquido, 0) > 0 THEN
        LEAST(
          COALESCE(b.valor_total_centro, 0),
          round(
            COALESCE(b.valor_baixado, 0) * COALESCE(b.valor_total_centro, 0)
            / NULLIF(b.valor_liquido, 0),
            2
          )
        )
      ELSE 0
    END AS valor_baixado_fatia
  FROM legacy_base b
),
legacy_rows AS (
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
    n.solicitacao_id,
    n.origem = 'sistema' AS previsto,
    n.matriz_cod_natureza AS cod_natureza,
    n.matriz_desc_natureza AS desc_natureza,
    n.matriz_grupo AS grupo,
    n.matriz_subgrupo AS subgrupo,
    CASE
      WHEN n.matriz_id IS NULL THEN COALESCE(n.valor_liquido, 0)
      ELSE n.matriz_valor_rateio
    END AS valor_rateio,
    n.matriz_status_lancamento AS status_lancamento,
    n.dias_atraso,
    COALESCE(n.matriz_centro_custo_tipo, n.centro_custo_tipo, 'nao_classificado') AS centro_custo_tipo,
    COALESCE(n.matriz_categoria_indireta, n.categoria_indireta) AS categoria_indireta,
    COALESCE(n.pendente_natureza, n.matriz_id IS NULL AND n.origem = 'totvs') AS pendente_natureza,
    GREATEST(n.relatorio_atualizado_em, n.matriz_atualizado_em) AS ultima_atualizacao,
    COALESCE(
      GREATEST(n.relatorio_atualizado_em, n.matriz_atualizado_em),
      '1970-01-01 00:00:00+00'::timestamptz
    ) < now() - interval '60 days' AS sem_atualizacao_recente,
    n.cnpj_cpf,
    n.historico
  FROM legacy_normalizado n
  LEFT JOIN public.obras o
    ON o.id = COALESCE(n.matriz_obra_id, n.obra_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.financeiro_titulos t
    WHERE t.origem_id = n.id
       OR (
         lower(btrim(t.origem_tipo)) = 'totvs'
         AND t.origem_ref IS NOT NULL
         AND btrim(t.origem_ref) = n.ref_lancamento::text
       )
  )
),
core_base AS (
  SELECT
    t.id AS titulo_id,
    t.tipo,
    t.filial,
    t.cnpj_cpf,
    t.nome,
    t.nome_fantasia,
    t.data_emissao,
    t.data_competencia,
    t.data_vencimento,
    t.valor_liquido,
    t.centro_custo AS titulo_centro_custo,
    t.obra_id AS titulo_obra_id,
    t.historico,
    t.origem_tipo,
    t.origem_ref,
    t.status,
    t.atualizado_em,
    tr.id AS rateio_id,
    tr.cod_natureza,
    COALESCE(tr.centro_custo, t.centro_custo) AS centro_custo,
    COALESCE(tr.obra_id, t.obra_id) AS obra_id,
    CASE
      WHEN tr.id IS NULL THEN t.valor_liquido
      WHEN tr.valor IS NOT NULL THEN tr.valor
      WHEN tr.percentual IS NOT NULL THEN round(t.valor_liquido * tr.percentual / 100.0, 2)
      ELSE 0::numeric
    END AS valor_rateio,
    pc.descricao AS desc_natureza,
    COALESCE(pc.grupo, split_part(COALESCE(tr.cod_natureza, ''), '.', 1)) AS grupo,
    COALESCE(
      pc.subgrupo,
      CASE
        WHEN tr.cod_natureza ~ '^[0-9]+\.[0-9]+' THEN
          split_part(tr.cod_natureza, '.', 1) || '.' || split_part(tr.cod_natureza, '.', 2)
        ELSE NULL
      END
    ) AS subgrupo
  FROM public.financeiro_titulos t
  LEFT JOIN public.financeiro_titulo_rateios tr
    ON tr.titulo_id = t.id
  LEFT JOIN public.plano_contas pc
    ON pc.cod_natureza = tr.cod_natureza
),
core_normalizado AS (
  SELECT
    cb.*,
    SUM(cb.valor_rateio) OVER (
      PARTITION BY cb.titulo_id, cb.obra_id, cb.centro_custo
    ) AS valor_liquido_fatia,
    CASE
      WHEN cb.rateio_id IS NULL THEN cb.titulo_id
      ELSE (
        substr(md5(cb.titulo_id::text || '|' || COALESCE(cb.obra_id::text, '') || '|' || COALESCE(cb.centro_custo, '')), 1, 8) || '-' ||
        substr(md5(cb.titulo_id::text || '|' || COALESCE(cb.obra_id::text, '') || '|' || COALESCE(cb.centro_custo, '')), 9, 4) || '-' ||
        substr(md5(cb.titulo_id::text || '|' || COALESCE(cb.obra_id::text, '') || '|' || COALESCE(cb.centro_custo, '')), 13, 4) || '-' ||
        substr(md5(cb.titulo_id::text || '|' || COALESCE(cb.obra_id::text, '') || '|' || COALESCE(cb.centro_custo, '')), 17, 4) || '-' ||
        substr(md5(cb.titulo_id::text || '|' || COALESCE(cb.obra_id::text, '') || '|' || COALESCE(cb.centro_custo, '')), 21, 12)
      )::uuid
    END AS lancamento_fatia_id
  FROM core_base cb
),
core_rows AS (
  SELECT
    c.lancamento_fatia_id AS lancamento_id,
    c.obra_id,
    o.nome AS obra_nome,
    o.codigo AS obra_codigo,
    c.centro_custo,
    cct.descricao AS desc_centro_custo,
    CASE
      WHEN lower(btrim(c.origem_tipo)) = 'totvs'
       AND c.origem_ref ~ '^[0-9]+$'
      THEN c.origem_ref::bigint
      ELSE NULL::bigint
    END AS ref_lancamento,
    CASE c.tipo
      WHEN 'receber' THEN 1::smallint
      WHEN 'pagar' THEN 2::smallint
      ELSE NULL::smallint
    END AS natureza_tipo,
    CASE
      WHEN c.status = 'baixado' THEN 3::smallint
      WHEN c.status = 'parcial' THEN 15::smallint
      WHEN c.status = 'cancelado' THEN 18::smallint
      WHEN c.data_vencimento = CURRENT_DATE THEN 29::smallint
      WHEN c.data_vencimento < CURRENT_DATE THEN 40::smallint
      ELSE 56::smallint
    END AS status_cod,
    CASE
      WHEN c.status = 'baixado' THEN 'Baixado'
      WHEN c.status = 'parcial' THEN 'Baixado - Parcial'
      WHEN c.status = 'cancelado' THEN 'Cancelado'
      WHEN c.data_vencimento = CURRENT_DATE THEN 'Vence Hoje'
      WHEN c.data_vencimento < CURRENT_DATE THEN 'Vencido'
      ELSE 'A Vencer'
    END AS status_label,
    COALESCE(c.nome_fantasia, c.nome) AS contraparte,
    COALESCE(c.nome_fantasia, c.nome) AS cliente_fornecedor,
    c.valor_liquido_fatia AS valor_liquido,
    CASE
      WHEN c.status = 'baixado' THEN c.valor_liquido_fatia
      ELSE 0::numeric
    END AS valor_baixado,
    c.data_emissao,
    c.data_vencimento,
    NULL::date AS data_pagamento,
    date_trunc('month', COALESCE(c.data_competencia, c.data_emissao))::date AS mes_competencia,
    c.data_competencia IS NULL AS mes_competencia_estimado,
    false AS dias_atraso_estimado,
    lower(btrim(c.origem_tipo)) AS origem,
    NULL::uuid AS solicitacao_id,
    false AS previsto,
    c.cod_natureza,
    c.desc_natureza,
    NULLIF(c.grupo, '') AS grupo,
    c.subgrupo,
    c.valor_rateio,
    CASE
      WHEN c.status = 'baixado' THEN 'Baixado'
      WHEN c.status = 'parcial' THEN 'Baixado - Parcial'
      WHEN c.status = 'cancelado' THEN 'Cancelado'
      ELSE 'Em aberto'
    END AS status_lancamento,
    CASE
      WHEN c.status IN ('baixado', 'cancelado') THEN 0
      WHEN c.data_vencimento < CURRENT_DATE THEN (CURRENT_DATE - c.data_vencimento)::integer
      ELSE 0
    END AS dias_atraso,
    COALESCE(cct.tipo, 'nao_classificado') AS centro_custo_tipo,
    cct.categoria AS categoria_indireta,
    c.rateio_id IS NULL AS pendente_natureza,
    c.atualizado_em AS ultima_atualizacao,
    false AS sem_atualizacao_recente,
    c.cnpj_cpf,
    c.historico
  FROM core_normalizado c
  LEFT JOIN public.obras o ON o.id = c.obra_id
  LEFT JOIN public.centros_custo_totvs cct ON cct.codigo = c.centro_custo
)
SELECT * FROM legacy_rows
UNION ALL
SELECT * FROM core_rows;

COMMENT ON VIEW public.vw_financeiro_obra IS
  'FIN-002: leitura operacional consolidada. Une snapshot/TOTVS e financeiro_titulos; deduplica somente por origem_id ou origem_ref TOTVS exata.';

REVOKE ALL ON public.vw_financeiro_obra FROM anon;
GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;
