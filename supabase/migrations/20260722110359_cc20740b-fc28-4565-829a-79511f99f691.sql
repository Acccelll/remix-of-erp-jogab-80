
-- ============ NEW TABLES ============

-- empresas
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  cor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read empresas" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write empresas" ON public.empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_empresas
CREATE TABLE public.user_empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_empresas TO authenticated;
GRANT ALL ON public.user_empresas TO service_role;
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read user_empresas" ON public.user_empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write user_empresas" ON public.user_empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- cards (Trello-like)
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGSERIAL,
  tipo TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'aberto',
  obra_id UUID,
  responsavel_id UUID,
  criado_por UUID,
  data_inicio DATE,
  prazo DATE,
  lembrete TIMESTAMPTZ,
  due_complete BOOLEAN DEFAULT false,
  arquivado BOOLEAN NOT NULL DEFAULT false,
  posicao NUMERIC,
  capa_cor TEXT,
  capa_url TEXT,
  cover_color TEXT,
  cover_url TEXT,
  cronograma_item_id UUID,
  grupo_negociacao_id UUID,
  origem_externa TEXT,
  origem_id TEXT,
  origem_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cards" ON public.cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cards" ON public.cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- card_membros
CREATE TABLE public.card_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros TO authenticated;
GRANT ALL ON public.card_membros TO service_role;
ALTER TABLE public.card_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_membros" ON public.card_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_membros" ON public.card_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- card_recursos
CREATE TABLE public.card_recursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  tipo_recurso TEXT,
  prazo_notif_compras DATE,
  prazo_pedido DATE,
  prazo_prod_iniciar DATE,
  prazo_notif_producao DATE,
  data_necessidade_obra DATE,
  valor_oc NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_recursos TO authenticated;
GRANT ALL ON public.card_recursos TO service_role;
ALTER TABLE public.card_recursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_recursos" ON public.card_recursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_recursos" ON public.card_recursos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- obra_membros
CREATE TABLE public.obra_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL,
  user_id UUID NOT NULL,
  papel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_membros TO authenticated;
GRANT ALL ON public.obra_membros TO service_role;
ALTER TABLE public.obra_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read obra_membros" ON public.obra_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write obra_membros" ON public.obra_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- frota_abastecimentos
CREATE TABLE public.frota_abastecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID,
  patrimonio_id UUID,
  obra_id UUID,
  data DATE NOT NULL,
  litros NUMERIC,
  valor NUMERIC,
  odometro NUMERIC,
  horimetro NUMERIC,
  combustivel TEXT,
  posto TEXT,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_abastecimentos TO authenticated;
GRANT ALL ON public.frota_abastecimentos TO service_role;
ALTER TABLE public.frota_abastecimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read frota_abast" ON public.frota_abastecimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write frota_abast" ON public.frota_abastecimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- frota_manutencoes
CREATE TABLE public.frota_manutencoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID,
  patrimonio_id UUID,
  obra_id UUID,
  tipo TEXT,
  data DATE NOT NULL,
  valor NUMERIC,
  descricao TEXT,
  fornecedor TEXT,
  odometro NUMERIC,
  horimetro NUMERIC,
  proxima_preventiva_horimetro NUMERIC,
  proxima_preventiva_data DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frota_manutencoes TO authenticated;
GRANT ALL ON public.frota_manutencoes TO service_role;
ALTER TABLE public.frota_manutencoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read frota_manut" ON public.frota_manutencoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write frota_manut" ON public.frota_manutencoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- nao_conformidades
CREATE TABLE public.nao_conformidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  severidade TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  obra_id UUID,
  quando_planejado DATE,
  prazo DATE,
  aguardando_reinspecao BOOLEAN DEFAULT false,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nao_conformidades TO authenticated;
GRANT ALL ON public.nao_conformidades TO service_role;
ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read nc" ON public.nao_conformidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write nc" ON public.nao_conformidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- security_events
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  user_id UUID,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  origem TEXT,
  sucesso BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth insert sec_events" ON public.security_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth read sec_events" ON public.security_events FOR SELECT TO authenticated USING (true);

-- ============ ADD MISSING COLUMNS ============

ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

ALTER TABLE public.financeiro_snapshots
  ADD COLUMN IF NOT EXISTS novos_sem_natureza INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matriz_atualizada_em TIMESTAMPTZ;

ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS aprovada_por UUID,
  ADD COLUMN IF NOT EXISTS aprovada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enviada_por UUID,
  ADD COLUMN IF NOT EXISTS enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeitada_por UUID,
  ADD COLUMN IF NOT EXISTS rejeitada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeicao_motivo TEXT;

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS calendario_uid_mpp TEXT,
  ADD COLUMN IF NOT EXISTS folga_livre_dias NUMERIC,
  ADD COLUMN IF NOT EXISTS fanout_sucessoras INTEGER,
  ADD COLUMN IF NOT EXISTS importancia_classe TEXT,
  ADD COLUMN IF NOT EXISTS importancia_score NUMERIC,
  ADD COLUMN IF NOT EXISTS localizacao_id UUID,
  ADD COLUMN IF NOT EXISTS recursos_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recursos_status TEXT,
  ADD COLUMN IF NOT EXISTS servico_lob TEXT;

ALTER TABLE public.bms_previstas
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_realizado NUMERIC;

-- ============ REBUILD vw_financeiro_obra ============
DROP VIEW IF EXISTS public.vw_financeiro_obra;
CREATE VIEW public.vw_financeiro_obra
WITH (security_invoker=on) AS
WITH ultimo AS (
  SELECT id FROM public.financeiro_snapshots ORDER BY importado_em DESC LIMIT 1
)
SELECT
  l.id AS lancamento_id,
  l.obra_id,
  o.nome AS obra_nome,
  o.codigo AS obra_codigo,
  l.centro_custo,
  l.desc_centro_custo,
  l.centro_custo_tipo,
  l.categoria_indireta,
  l.ref_lancamento,
  l.natureza_tipo,
  l.status_cod,
  l.status_label,
  l.nome AS contraparte,
  l.cliente_fornecedor,
  l.valor_liquido,
  l.valor_baixado,
  l.data_emissao,
  l.data_vencimento,
  l.data_pagamento,
  l.mes_competencia,
  l.origem,
  r.cod_natureza,
  r.desc_natureza,
  r.grupo,
  r.subgrupo,
  r.valor_rateio,
  r.status_lancamento
FROM public.financeiro_lancamentos l
JOIN ultimo u ON u.id = l.snapshot_id
LEFT JOIN public.obras o ON o.id = l.obra_id
LEFT JOIN public.financeiro_rateios r ON r.lancamento_id = l.id;

GRANT SELECT ON public.vw_financeiro_obra TO authenticated, service_role;
