
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS superseded_by UUID
    REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_superseded_by
  ON public.financeiro_lancamentos(superseded_by)
  WHERE superseded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_origem_sistema_ativo
  ON public.financeiro_lancamentos(obra_id, centro_custo, data_vencimento)
  WHERE origem = 'sistema' AND superseded_by IS NULL;

CREATE OR REPLACE FUNCTION public.fn_lancamento_solicitacao_aprovada(
  p_solicitacao_id uuid, p_obra_id uuid, p_centro_custo text,
  p_valor numeric, p_data_prevista date, p_descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_snap_id UUID; v_lanc_id UUID;
BEGIN
  SELECT id INTO v_snap_id FROM public.financeiro_snapshots
   ORDER BY importado_em DESC LIMIT 1;
  IF v_snap_id IS NULL THEN
    INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
    VALUES ('sistema', 'sistema') RETURNING id INTO v_snap_id;
  END IF;
  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, obra_id, centro_custo,
    valor_liquido, valor_original, data_vencimento,
    natureza_tipo, status_cod, status_label, historico, origem, solicitacao_id
  ) VALUES (
    v_snap_id, (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    p_obra_id, p_centro_custo, p_valor, p_valor, p_data_prevista,
    2::smallint, 1, 'Compromisso (solicitação aprovada)',
    COALESCE(p_descricao, 'Solicitação aprovada'), 'sistema', p_solicitacao_id
  ) RETURNING id INTO v_lanc_id;
  RETURN v_lanc_id;
END $$;

DROP VIEW IF EXISTS public.vw_financeiro_obra;

CREATE VIEW public.vw_financeiro_obra AS
WITH ultimo AS (
  SELECT fs.id FROM financeiro_snapshots fs
   ORDER BY fs.importado_em DESC LIMIT 1
), base AS (
  SELECT l.id, l.snapshot_id, l.ref_lancamento, l.filial,
    l.centro_custo, l.desc_centro_custo, l.obra_id,
    l.natureza_tipo, l.status_cod, l.status_label,
    l.tipo_documento, l.numero_documento, l.cnpj_cpf,
    l.nome, l.nome_fantasia, l.cliente_fornecedor,
    l.valor_original, l.valor_desconto, l.valor_liquido, l.valor_baixado,
    l.data_emissao, l.data_vencimento, l.data_baixa, l.data_pagamento,
    l.dias_atraso, l.mes_competencia, l.historico,
    l.centro_custo_tipo, l.categoria_indireta,
    l.origem, l.solicitacao_id, l.conciliado, l.pendente_natureza,
    l.mes_competencia_estimado, l.dias_atraso_estimado,
    m.id AS matriz_id,
    m.cod_natureza AS matriz_cod_natureza,
    m.desc_natureza AS matriz_desc_natureza,
    COALESCE(m.grupo, split_part(COALESCE(m.cod_natureza,''),'.',1)) AS matriz_grupo,
    COALESCE(m.subgrupo,
      CASE WHEN m.cod_natureza ~ '^[0-9]+\.[0-9]+'
        THEN split_part(m.cod_natureza,'.',1)||'.'||split_part(m.cod_natureza,'.',2)
        ELSE NULL END) AS matriz_subgrupo,
    m.cod_ccusto AS matriz_centro_custo,
    m.desc_ccusto AS matriz_desc_centro_custo,
    GREATEST(COALESCE(m.valor_rateio, 0), 0) AS matriz_valor_rateio,
    m.situacao_presumida AS matriz_status_lancamento,
    m.atualizado_em AS matriz_atualizado_em,
    r.atualizado_em AS relatorio_atualizado_em,
    cct.obra_id AS matriz_obra_id,
    cct.tipo AS matriz_centro_custo_tipo,
    cct.categoria AS matriz_categoria_indireta,
    SUM(GREATEST(COALESCE(m.valor_rateio, 0), 0))
      OVER (PARTITION BY l.id, COALESCE(m.cod_ccusto, l.centro_custo, '')) AS valor_total_centro
  FROM financeiro_lancamentos l
  JOIN ultimo u ON u.id = l.snapshot_id
  LEFT JOIN financeiro_matriz_rateios m
    ON m.ref_lancamento = l.ref_lancamento
   AND COALESCE(l.pendente_natureza,false) = false
   AND l.origem = 'totvs'
  LEFT JOIN centros_custo_totvs cct ON cct.codigo = m.cod_ccusto
  LEFT JOIN financeiro_relatorio_status_atual r ON r.ref_lancamento = l.ref_lancamento
  WHERE l.origem IN ('totvs','sistema')
    AND l.superseded_by IS NULL
), normalizado AS (
  SELECT b.*,
    CASE WHEN b.matriz_id IS NULL THEN b.id
      ELSE (substr(md5((b.id::text||'|'||COALESCE(b.matriz_centro_custo,b.centro_custo,''))),1,8)||'-'||
            substr(md5((b.id::text||'|'||COALESCE(b.matriz_centro_custo,b.centro_custo,''))),9,4)||'-'||
            substr(md5((b.id::text||'|'||COALESCE(b.matriz_centro_custo,b.centro_custo,''))),13,4)||'-'||
            substr(md5((b.id::text||'|'||COALESCE(b.matriz_centro_custo,b.centro_custo,''))),17,4)||'-'||
            substr(md5((b.id::text||'|'||COALESCE(b.matriz_centro_custo,b.centro_custo,''))),21,12))::uuid
    END AS lancamento_fatia_id,
    CASE WHEN b.matriz_id IS NULL THEN COALESCE(b.valor_liquido,0)
      ELSE COALESCE(b.valor_total_centro,0) END AS valor_liquido_fatia,
    CASE
      WHEN b.matriz_id IS NULL THEN COALESCE(b.valor_baixado,0)
      WHEN b.status_cod = 3 THEN COALESCE(b.valor_total_centro,0)
      WHEN b.status_cod = 15 AND COALESCE(b.valor_liquido,0) > 0
        THEN LEAST(COALESCE(b.valor_total_centro,0),
                   round((COALESCE(b.valor_baixado,0)*COALESCE(b.valor_total_centro,0))/NULLIF(b.valor_liquido,0),2))
      ELSE 0 END AS valor_baixado_fatia
  FROM base b
)
SELECT n.lancamento_fatia_id AS lancamento_id,
  COALESCE(n.matriz_obra_id, n.obra_id) AS obra_id,
  o.nome AS obra_nome, o.codigo AS obra_codigo,
  COALESCE(n.matriz_centro_custo, n.centro_custo) AS centro_custo,
  COALESCE(n.matriz_desc_centro_custo, n.desc_centro_custo) AS desc_centro_custo,
  n.ref_lancamento,
  COALESCE(n.natureza_tipo,
    CASE WHEN n.matriz_grupo='1' THEN 1::smallint
         WHEN n.matriz_grupo IN ('2','3') THEN 2::smallint
         ELSE NULL END) AS natureza_tipo,
  n.status_cod, n.status_label,
  n.nome AS contraparte, n.cliente_fornecedor,
  n.valor_liquido_fatia AS valor_liquido,
  n.valor_baixado_fatia AS valor_baixado,
  n.data_emissao, n.data_vencimento, n.data_pagamento,
  n.mes_competencia, n.mes_competencia_estimado, n.dias_atraso_estimado,
  n.origem, n.solicitacao_id,
  (n.origem = 'sistema') AS previsto,
  n.matriz_cod_natureza AS cod_natureza,
  n.matriz_desc_natureza AS desc_natureza,
  n.matriz_grupo AS grupo, n.matriz_subgrupo AS subgrupo,
  CASE WHEN n.matriz_id IS NULL THEN COALESCE(n.valor_liquido,0)
       ELSE n.matriz_valor_rateio END AS valor_rateio,
  n.matriz_status_lancamento AS status_lancamento,
  n.dias_atraso,
  COALESCE(n.matriz_centro_custo_tipo, n.centro_custo_tipo, 'nao_classificado') AS centro_custo_tipo,
  COALESCE(n.matriz_categoria_indireta, n.categoria_indireta) AS categoria_indireta,
  COALESCE(n.pendente_natureza, (n.matriz_id IS NULL AND n.origem='totvs')) AS pendente_natureza,
  GREATEST(n.relatorio_atualizado_em, n.matriz_atualizado_em) AS ultima_atualizacao,
  (COALESCE(GREATEST(n.relatorio_atualizado_em, n.matriz_atualizado_em),
            '1970-01-01 00:00:00+00'::timestamptz) < (now() - interval '60 days')) AS sem_atualizacao_recente
FROM normalizado n
LEFT JOIN obras o ON o.id = COALESCE(n.matriz_obra_id, n.obra_id);

GRANT SELECT ON public.vw_financeiro_obra TO authenticated;
GRANT SELECT ON public.vw_financeiro_obra TO service_role;

CREATE OR REPLACE FUNCTION public.fn_sugerir_reconciliacoes_previsto(
  p_tolerancia_pct numeric DEFAULT 0.01,
  p_janela_dias int DEFAULT 15
)
RETURNS TABLE (
  sistema_id uuid, totvs_id uuid, solicitacao_id uuid,
  obra_id uuid, centro_custo text,
  valor_sistema numeric, valor_totvs numeric,
  data_prevista date, data_vencimento_totvs date,
  ref_lancamento_totvs bigint, contraparte_totvs text, diff_dias int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, t.id, s.solicitacao_id,
    s.obra_id, s.centro_custo,
    s.valor_liquido, t.valor_liquido,
    s.data_vencimento, t.data_vencimento,
    t.ref_lancamento, t.nome,
    ABS((t.data_vencimento - s.data_vencimento))::int
  FROM public.financeiro_lancamentos s
  JOIN public.financeiro_lancamentos t
    ON t.origem = 'totvs' AND t.superseded_by IS NULL
   AND COALESCE(t.obra_id::text,'') = COALESCE(s.obra_id::text,'')
   AND (s.valor_liquido = 0
        OR ABS(t.valor_liquido - s.valor_liquido) <= (ABS(s.valor_liquido) * p_tolerancia_pct))
   AND s.data_vencimento IS NOT NULL AND t.data_vencimento IS NOT NULL
   AND ABS((t.data_vencimento - s.data_vencimento)) <= p_janela_dias
  WHERE s.origem = 'sistema' AND s.superseded_by IS NULL
  ORDER BY s.id, ABS((t.data_vencimento - s.data_vencimento));
$$;

CREATE OR REPLACE FUNCTION public.fn_reconciliar_previsto(p_sistema_id uuid, p_totvs_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol_id uuid;
BEGIN
  SELECT solicitacao_id INTO v_sol_id
    FROM public.financeiro_lancamentos
   WHERE id = p_sistema_id AND origem = 'sistema';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lançamento previsto % não encontrado', p_sistema_id;
  END IF;
  UPDATE public.financeiro_lancamentos
     SET superseded_by = p_totvs_id
   WHERE id = p_sistema_id;
  UPDATE public.financeiro_lancamentos
     SET solicitacao_id = COALESCE(solicitacao_id, v_sol_id)
   WHERE id = p_totvs_id AND origem = 'totvs';
END $$;
