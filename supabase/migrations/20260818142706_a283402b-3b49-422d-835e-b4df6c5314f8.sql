-- Fase 1 (evolução de Suprimentos): categoria/subcategoria em insumos,
-- unicidade de código quando preenchido, e views de histórico/custo de
-- referência reaproveitando dados já existentes de cotações/compras/recebimento.
-- Não altera nenhuma tabela de forma destrutiva; não sobrescreve preco_unitario.

-- 1. Insumos: categoria/subcategoria (aditivo, nullable)
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS subcategoria text;

-- Unicidade de código só quando preenchido — não força NOT NULL porque não há
-- como validar, sem acesso ao banco em produção, se já existem duplicados hoje.
-- Se a migration falhar aqui, é sinal de dado duplicado a limpar manualmente
-- antes de reaplicar (falha segura: não corrompe dado, só impede o deploy).
CREATE UNIQUE INDEX IF NOT EXISTS insumos_codigo_uq ON public.insumos(codigo) WHERE codigo IS NOT NULL;

-- 2. View: histórico agregado de fornecedor (preço médio vencedor, taxa de
-- vitória em cotação, prazo médio prometido vs. real de entrega).
-- Somente leitura, RLS herdada das tabelas de origem via security_invoker.
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
  ) AS prazo_medio_real_dias
FROM public.fornecedores f
LEFT JOIN public.cotacao_propostas cp ON cp.fornecedor_id = f.id
LEFT JOIN public.ordens_compra oc ON oc.fornecedor_id = f.id
LEFT JOIN public.recebimento_materiais rm ON rm.ordem_compra_id = oc.id
GROUP BY f.id, f.razao_social;

GRANT SELECT ON public.vw_fornecedor_historico TO authenticated;

-- 3. View: custo de referência do insumo, a partir de compra real.
-- Deliberadamente NÃO sobrescreve insumos.preco_unitario (evita mudar
-- comportamento de orçamentos existentes sem confirmação explícita) —
-- é só informativa, para o time decidir manualmente se/quando atualizar.
CREATE OR REPLACE VIEW public.vw_insumo_custo_referencia
WITH (security_invoker = true) AS
SELECT
  i.id AS insumo_id,
  i.descricao,
  i.preco_unitario AS preco_cadastrado,
  ROUND(AVG(cp.preco_unitario) FILTER (WHERE cp.escolhida), 4) AS preco_medio_cotado_vencedor,
  ROUND(AVG(oci.preco_unitario), 4) AS preco_medio_comprado,
  MAX(rm.data_recebimento) AS ultima_compra_em
FROM public.insumos i
LEFT JOIN public.requisicoes r ON r.insumo_id = i.id
LEFT JOIN public.cotacoes c ON c.requisicao_id = r.id
LEFT JOIN public.cotacao_propostas cp ON cp.cotacao_id = c.id AND cp.escolhida
LEFT JOIN public.ordem_compra_itens oci ON oci.insumo_id = i.id
LEFT JOIN public.recebimento_itens ri ON ri.ordem_compra_item_id = oci.id
LEFT JOIN public.recebimento_materiais rm ON rm.id = ri.recebimento_id
GROUP BY i.id, i.descricao, i.preco_unitario;

GRANT SELECT ON public.vw_insumo_custo_referencia TO authenticated;
