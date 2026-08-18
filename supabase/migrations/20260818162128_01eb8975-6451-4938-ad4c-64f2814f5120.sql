-- Fase 4 (evolução de Suprimentos): Nota fiscal de entrada + rastreio.
--
-- Greenfield nos dois bancos (confirmado no roadmap: `notas_fiscais`/
-- `faturamento_nfse` são de SAÍDA/faturamento — NFS-e municipal, sem chave
-- de acesso; nota de entrada é NF-e nacional/SEFAZ, formato diferente).
-- Reaproveita o bucket de storage "nfs" já existente (hoje só usado por
-- faturamento) e o padrão de RPC de fn_lancamento_solicitacao_aprovada para
-- gerar título financeiro automaticamente.

-- Fornecedores ganham prazo de pagamento (faltava — Clientes já tem;
-- necessário para calcular vencimento do título gerado pela NF de entrada).
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS prazo_pagamento_dias integer;

CREATE TABLE public.notas_fiscais_entrada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_compra_id uuid NOT NULL REFERENCES public.ordens_compra(id) ON DELETE RESTRICT,
  recebimento_id uuid REFERENCES public.recebimento_materiais(id) ON DELETE SET NULL,
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  chave_acesso char(44) UNIQUE,
  numero text,
  serie text,
  cnpj_emitente text,
  cnpj_destinatario text,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  data_emissao date,
  xml_path text,
  status_validacao text NOT NULL DEFAULT 'pendente'
    CHECK (status_validacao IN ('pendente','validada','divergente','rejeitada')),
  status_sefaz text,
  lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  owner_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfe_oc ON public.notas_fiscais_entrada(ordem_compra_id);
CREATE INDEX idx_nfe_fornecedor ON public.notas_fiscais_entrada(fornecedor_id);
CREATE INDEX idx_nfe_recebimento ON public.notas_fiscais_entrada(recebimento_id);

DROP TRIGGER IF EXISTS touch_nfe ON public.notas_fiscais_entrada;
CREATE TRIGGER touch_nfe BEFORE UPDATE ON public.notas_fiscais_entrada
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.nota_fiscal_entrada_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_fiscal_entrada_id uuid NOT NULL REFERENCES public.notas_fiscais_entrada(id) ON DELETE CASCADE,
  ordem_compra_item_id uuid REFERENCES public.ordem_compra_itens(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  quantidade numeric(14,4) NOT NULL DEFAULT 0,
  valor_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor_total numeric(14,2) GENERATED ALWAYS AS (round((quantidade * valor_unitario)::numeric, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nfe_itens_nfe ON public.nota_fiscal_entrada_itens(nota_fiscal_entrada_id);
CREATE INDEX idx_nfe_itens_oci ON public.nota_fiscal_entrada_itens(ordem_compra_item_id);

-- Gera título financeiro a partir da nota fiscal de entrada, no mesmo molde
-- de fn_lancamento_solicitacao_aprovada (20260618151958_...sql:114-137) —
-- ref_lancamento sintético (epoch ms), snapshot "sistema" criado sob demanda.
CREATE OR REPLACE FUNCTION public.fn_lancamento_nota_fiscal_entrada(p_nota_fiscal_entrada_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nota public.notas_fiscais_entrada%ROWTYPE;
  v_oc public.ordens_compra%ROWTYPE;
  v_fornecedor public.fornecedores%ROWTYPE;
  v_snap_id uuid;
  v_lanc_id uuid;
  v_prazo integer;
  v_vencimento date;
BEGIN
  SELECT * INTO v_nota FROM public.notas_fiscais_entrada WHERE id = p_nota_fiscal_entrada_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota fiscal de entrada % não encontrada', p_nota_fiscal_entrada_id USING ERRCODE='P0002'; END IF;
  IF v_nota.lancamento_id IS NOT NULL THEN
    RAISE EXCEPTION 'Nota fiscal já gerou título (lancamento_id=%)', v_nota.lancamento_id USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = v_nota.ordem_compra_id;
  SELECT * INTO v_fornecedor FROM public.fornecedores WHERE id = v_nota.fornecedor_id;

  v_prazo := COALESCE(v_fornecedor.prazo_pagamento_dias, 30);
  v_vencimento := COALESCE(v_nota.data_emissao, CURRENT_DATE) + (v_prazo || ' days')::interval;

  SELECT id INTO v_snap_id FROM public.financeiro_snapshots ORDER BY importado_em DESC LIMIT 1;
  IF v_snap_id IS NULL THEN
    INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
    VALUES ('sistema', 'sistema') RETURNING id INTO v_snap_id;
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, obra_id, centro_custo,
    valor_liquido, valor_original, data_vencimento,
    status_cod, status_label, historico, origem
  ) VALUES (
    v_snap_id, (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    v_oc.obra_id, NULL, v_nota.valor_total, v_nota.valor_total, v_vencimento,
    1, 'Compromisso (nota fiscal de entrada)',
    'NF ' || COALESCE(v_nota.numero, v_nota.id::text) || ' — ' || COALESCE(v_fornecedor.razao_social, 'fornecedor'),
    'sistema'
  ) RETURNING id INTO v_lanc_id;

  UPDATE public.notas_fiscais_entrada SET lancamento_id = v_lanc_id WHERE id = p_nota_fiscal_entrada_id;

  RETURN v_lanc_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_lancamento_nota_fiscal_entrada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lancamento_nota_fiscal_entrada(uuid) TO authenticated, service_role;

-- GRANTs e RLS — mesmo padrão de Suprimentos.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notas_fiscais_entrada', 'nota_fiscal_entrada_itens'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

CREATE POLICY "notas_fiscais_entrada read" ON public.notas_fiscais_entrada FOR SELECT TO authenticated
  USING (
    public.current_is_gm() OR public.current_has_setor('Compras') OR public.current_has_setor('Almoxarifado')
    OR public.current_has_setor('Financeiro') OR public.current_has_setor('Engenharia')
    OR EXISTS (SELECT 1 FROM public.ordens_compra oc WHERE oc.id = notas_fiscais_entrada.ordem_compra_id AND public.user_em_obra(oc.obra_id))
  );
CREATE POLICY "notas_fiscais_entrada write" ON public.notas_fiscais_entrada FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Compras') OR public.current_has_setor('Almoxarifado'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Compras') OR public.current_has_setor('Almoxarifado'));

CREATE POLICY "nota_fiscal_entrada_itens read" ON public.nota_fiscal_entrada_itens FOR SELECT TO authenticated
  USING (
    public.current_is_gm() OR public.current_has_setor('Compras') OR public.current_has_setor('Almoxarifado')
    OR public.current_has_setor('Financeiro') OR public.current_has_setor('Engenharia')
    OR EXISTS (
      SELECT 1 FROM public.notas_fiscais_entrada nfe
      JOIN public.ordens_compra oc ON oc.id = nfe.ordem_compra_id
      WHERE nfe.id = nota_fiscal_entrada_itens.nota_fiscal_entrada_id AND public.user_em_obra(oc.obra_id)
    )
  );
CREATE POLICY "nota_fiscal_entrada_itens write" ON public.nota_fiscal_entrada_itens FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Compras') OR public.current_has_setor('Almoxarifado'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Compras') OR public.current_has_setor('Almoxarifado'));

-- Estende vw_fornecedor_historico (Fase 1.1) com dado real de nota fiscal de
-- entrada, como previsto no roadmap — mesma definição, só soma a contagem.
CREATE OR REPLACE VIEW public.vw_fornecedor_historico
WITH (security_invoker = true) AS
SELECT
  f.id AS fornecedor_id,
  f.razao_social,
  COUNT(DISTINCT cp.cotacao_id) AS total_cotacoes,
  COUNT(DISTINCT cp.cotacao_id) FILTER (WHERE cp.escolhida) AS cotacoes_vencidas,
  ROUND(
    (COUNT(DISTINCT cp.cotacao_id) FILTER (WHERE cp.escolhida))::numeric
      / NULLIF(COUNT(DISTINCT cp.cotacao_id), 0) * 100,
    1
  ) AS taxa_vitoria_pct,
  ROUND(AVG(cp.preco_unitario) FILTER (WHERE cp.escolhida), 4) AS preco_medio_vencedor,
  ROUND(AVG(cp.prazo_entrega_dias) FILTER (WHERE cp.escolhida), 1) AS prazo_medio_prometido_dias,
  ROUND(
    AVG(rm.data_recebimento - oc.emitida_em::date) FILTER (WHERE oc.emitida_em IS NOT NULL),
    1
  ) AS prazo_medio_real_dias,
  COUNT(DISTINCT nfe.id) AS total_notas_fiscais_entrada
FROM public.fornecedores f
LEFT JOIN public.cotacao_propostas cp ON cp.fornecedor_id = f.id
LEFT JOIN public.ordens_compra oc ON oc.fornecedor_id = f.id
LEFT JOIN public.recebimento_materiais rm ON rm.ordem_compra_id = oc.id
LEFT JOIN public.notas_fiscais_entrada nfe ON nfe.fornecedor_id = f.id
GROUP BY f.id, f.razao_social;
