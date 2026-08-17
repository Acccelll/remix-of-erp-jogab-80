-- Fase 1 · Antecipação de Recebíveis — Núcleo (operadores, operações, títulos, liquidações)

-- ENUMs
CREATE TYPE public.antecipacao_status AS ENUM ('rascunho','aprovada','liquidada','cancelada');
CREATE TYPE public.antecipacao_tipo AS ENUM ('desconto_titulo','cessao','risco_sacado');
CREATE TYPE public.operador_tipo AS ENUM ('fidc','banco','securitizadora','cliente_proprio','outro');

-- 1) Operadores de crédito
CREATE TABLE public.operadores_credito (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  apelido text,
  cnpj text,
  tipo public.operador_tipo NOT NULL DEFAULT 'fidc',
  ativo boolean NOT NULL DEFAULT true,
  taxa_referencia_am numeric(8,4),
  contato text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_operadores_credito__nome UNIQUE (nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operadores_credito TO authenticated;
GRANT ALL ON public.operadores_credito TO service_role;
ALTER TABLE public.operadores_credito ENABLE ROW LEVEL SECURITY;
CREATE POLICY operadores_credito_read ON public.operadores_credito FOR SELECT TO authenticated USING (true);
CREATE POLICY operadores_credito_write ON public.operadores_credito FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role));

-- 2) Operações
CREATE TABLE public.antecipacao_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_interno text,
  operador_id uuid NOT NULL REFERENCES public.operadores_credito(id),
  tipo public.antecipacao_tipo NOT NULL DEFAULT 'desconto_titulo',
  data_operacao date NOT NULL,
  data_vencimento_repasse date,
  valor_face_total numeric(14,2) NOT NULL DEFAULT 0,
  valor_liquido_recebido numeric(14,2) NOT NULL DEFAULT 0,
  desagio_total numeric(14,2) NOT NULL DEFAULT 0,
  iof numeric(14,2) NOT NULL DEFAULT 0,
  tarifas numeric(14,2) NOT NULL DEFAULT 0,
  com_coobrigacao boolean NOT NULL DEFAULT true,
  status public.antecipacao_status NOT NULL DEFAULT 'rascunho',
  solicitacao_id uuid REFERENCES public.solicitacoes_financeiras(id) ON DELETE SET NULL,
  criado_por text,
  aprovado_por text,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_antecipacao_operacoes__valores CHECK (valor_liquido_recebido <= valor_face_total)
);
CREATE INDEX ix_antecipacao_operacoes__operador ON public.antecipacao_operacoes(operador_id);
CREATE INDEX ix_antecipacao_operacoes__data ON public.antecipacao_operacoes(data_operacao);
CREATE INDEX ix_antecipacao_operacoes__status ON public.antecipacao_operacoes(status);
CREATE INDEX ix_antecipacao_operacoes__venc_repasse ON public.antecipacao_operacoes(data_vencimento_repasse);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.antecipacao_operacoes TO authenticated;
GRANT ALL ON public.antecipacao_operacoes TO service_role;
ALTER TABLE public.antecipacao_operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY antecipacao_operacoes_read ON public.antecipacao_operacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY antecipacao_operacoes_write ON public.antecipacao_operacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role));

-- 3) Títulos
CREATE TABLE public.antecipacao_titulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES public.antecipacao_operacoes(id) ON DELETE CASCADE,
  faturamento_nfse_id uuid NOT NULL REFERENCES public.faturamento_nfse(id) ON DELETE RESTRICT,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  valor_face numeric(14,2) NOT NULL DEFAULT 0,
  valor_antecipado numeric(14,2) NOT NULL DEFAULT 0,
  desagio_rateado numeric(14,2) NOT NULL DEFAULT 0,
  iof_rateado numeric(14,2) NOT NULL DEFAULT 0,
  data_vencimento_original date,
  dias_exposicao integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_antecipacao_titulos__operacao ON public.antecipacao_titulos(operacao_id);
CREATE INDEX ix_antecipacao_titulos__nfse ON public.antecipacao_titulos(faturamento_nfse_id);
CREATE INDEX ix_antecipacao_titulos__obra ON public.antecipacao_titulos(obra_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.antecipacao_titulos TO authenticated;
GRANT ALL ON public.antecipacao_titulos TO service_role;
ALTER TABLE public.antecipacao_titulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY antecipacao_titulos_read ON public.antecipacao_titulos FOR SELECT TO authenticated USING (true);
CREATE POLICY antecipacao_titulos_write ON public.antecipacao_titulos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role));

-- 4) Liquidações
CREATE TABLE public.antecipacao_liquidacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id uuid NOT NULL REFERENCES public.antecipacao_operacoes(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('recebimento_fundo','repasse','recompra','ajuste')),
  valor numeric(14,2) NOT NULL DEFAULT 0,
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_antecipacao_liquidacoes__operacao ON public.antecipacao_liquidacoes(operacao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.antecipacao_liquidacoes TO authenticated;
GRANT ALL ON public.antecipacao_liquidacoes TO service_role;
ALTER TABLE public.antecipacao_liquidacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY antecipacao_liquidacoes_read ON public.antecipacao_liquidacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY antecipacao_liquidacoes_write ON public.antecipacao_liquidacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'financeiro'::public.app_role) OR public.has_role(auth.uid(),'gm'::public.app_role));

-- Triggers updated_at
CREATE TRIGGER trg_touch_operadores_credito BEFORE UPDATE ON public.operadores_credito
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_antecipacao_operacoes BEFORE UPDATE ON public.antecipacao_operacoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_antecipacao_titulos BEFORE UPDATE ON public.antecipacao_titulos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed operadores
INSERT INTO public.operadores_credito (nome, apelido, tipo) VALUES
  ('TRUST', NULL, 'fidc'),
  ('BLACKBIRD', NULL, 'fidc'),
  ('DAYCOVAL', NULL, 'banco'),
  ('ONE7', 'GR', 'fidc'),
  ('RAÍZEN', NULL, 'cliente_proprio'),
  ('BLACK', NULL, 'fidc')
ON CONFLICT (nome) DO NOTHING;