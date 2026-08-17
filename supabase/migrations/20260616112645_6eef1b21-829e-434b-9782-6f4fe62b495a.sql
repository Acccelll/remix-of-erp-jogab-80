-- ============================================================
-- ONDA A-01: Enums e funções utilitárias do flowcast
-- ============================================================
DO $$ BEGIN CREATE TYPE public.medicao_status AS ENUM ('rascunho','em_revisao','enviada','aprovada','faturada','cancelada','rejeitada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.recebimento_status AS ENUM ('previsto','a_receber','parcial','pago','recebido','atrasado','inadimplente','antecipado','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.nf_status AS ENUM ('rascunho','emitida','enviada','aprovada_cliente','recebida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.aditivo_status AS ENUM ('rascunho','aprovado','cancelado'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.aditivo_tipo AS ENUM ('acrescimo','supressao','reajuste','prazo','misto'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.obra_status AS ENUM ('planejada','em_andamento','paralisada','concluida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ocorrencia_status AS ENUM ('aberta','em_andamento','resolvida','cancelada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.fn_bump_versao_otimista()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.versao_otimista := COALESCE(OLD.versao_otimista, 0) + 1; RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NULL, entidade text NOT NULL, entidade_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete','approve','cancel')),
  before jsonb NULL, after jsonb NULL, user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated, anon;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs planifik" ON public.audit_logs;
CREATE POLICY "audit_logs planifik" ON public.audit_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_audit_logs_obra ON public.audit_logs(obra_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entidade ON public.audit_logs(entidade, entidade_id);

CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_obra_id uuid; v_acao text; v_before jsonb; v_after jsonb; v_entidade_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN v_acao := 'insert'; v_before := NULL; v_after := to_jsonb(NEW); v_entidade_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN v_acao := 'update'; v_before := to_jsonb(OLD); v_after := to_jsonb(NEW); v_entidade_id := NEW.id;
  ELSE v_acao := 'delete'; v_before := to_jsonb(OLD); v_after := NULL; v_entidade_id := OLD.id; END IF;
  BEGIN v_obra_id := CASE
    WHEN TG_TABLE_NAME IN ('obras') THEN v_entidade_id
    ELSE (CASE WHEN TG_OP = 'DELETE' THEN (v_before->>'obra_id')::uuid ELSE (v_after->>'obra_id')::uuid END)
  END; EXCEPTION WHEN OTHERS THEN v_obra_id := NULL; END;
  INSERT INTO public.audit_logs(obra_id, entidade, entidade_id, acao, before, after)
  VALUES (v_obra_id, TG_TABLE_NAME, v_entidade_id, v_acao, v_before, v_after);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- ONDA A-02: clientes, plano_contas, financeiro_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL, cnpj TEXT,
  prazo_pagamento_dias INTEGER,
  dias_fixos_pagamento INTEGER[] NOT NULL DEFAULT '{}',
  dia_fixo_pagamento INTEGER, observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated, anon;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes planifik" ON public.clientes;
CREATE POLICY "clientes planifik" ON public.clientes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_clientes_updated ON public.clientes;
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.plano_contas (
  cod_natureza TEXT PRIMARY KEY, descricao TEXT NOT NULL, nivel SMALLINT NOT NULL,
  cod_pai TEXT, grupo TEXT NOT NULL, subgrupo TEXT, ativo BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_contas TO authenticated, anon;
GRANT ALL ON public.plano_contas TO service_role;
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plano_contas planifik" ON public.plano_contas;
CREATE POLICY "plano_contas planifik" ON public.plano_contas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.financeiro_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  periodo_ref TEXT, nome_arquivo_titulos TEXT, nome_arquivo_rateios TEXT,
  total_titulos INT NOT NULL DEFAULT 0, total_rateios INT NOT NULL DEFAULT 0,
  total_valor NUMERIC NOT NULL DEFAULT 0, titulos_sem_obra INT NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_snapshots TO authenticated, anon;
GRANT ALL ON public.financeiro_snapshots TO service_role;
ALTER TABLE public.financeiro_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fin_snapshots planifik" ON public.financeiro_snapshots;
CREATE POLICY "fin_snapshots planifik" ON public.financeiro_snapshots FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- ============================================================
-- ONDA A-03: Obras canônicas (estende tabela existente, SEM backfill de cliente)
-- ============================================================
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS flowcast_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_totvs TEXT,
  ADD COLUMN IF NOT EXISTS centro_custo_totvs TEXT,
  ADD COLUMN IF NOT EXISTS pedido_contrato TEXT,
  ADD COLUMN IF NOT EXISTS local TEXT,
  ADD COLUMN IF NOT EXISTS valor_contrato NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS percentual_antecipacao NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_antecipacao NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS data_fim DATE,
  ADD COLUMN IF NOT EXISTS data_previsao_termino DATE,
  ADD COLUMN IF NOT EXISTS regra_medicao TEXT,
  ADD COLUMN IF NOT EXISTS prazo_emitir_nf_dias INTEGER,
  ADD COLUMN IF NOT EXISTS prazo_pagamento_dias INTEGER,
  ADD COLUMN IF NOT EXISTS dia_fixo_pagamento INTEGER,
  ADD COLUMN IF NOT EXISTS status public.obra_status NOT NULL DEFAULT 'em_andamento',
  ADD COLUMN IF NOT EXISTS percentual_material NUMERIC NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS aliquota_iss NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS aliquota_inss NUMERIC NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS aliquota_cbs NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_ibs NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS obras_centro_custo_totvs_uidx
  ON public.obras (centro_custo_totvs) WHERE centro_custo_totvs IS NOT NULL;
CREATE INDEX IF NOT EXISTS obras_cliente_id_idx ON public.obras (cliente_id);

DROP TRIGGER IF EXISTS trg_obras_updated ON public.obras;
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON public.obras FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- ONDA A-04: centros_custo_totvs (sem backfill automático)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.centros_custo_totvs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descricao text,
  tipo text NOT NULL CHECK (tipo IN ('obra','indireto')),
  categoria text,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (tipo = 'obra' AND obra_id IS NOT NULL AND categoria IS NULL)
    OR (tipo = 'indireto' AND categoria IS NOT NULL AND obra_id IS NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo_totvs TO authenticated, anon;
GRANT ALL ON public.centros_custo_totvs TO service_role;
ALTER TABLE public.centros_custo_totvs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "centros_custo_totvs planifik" ON public.centros_custo_totvs;
CREATE POLICY "centros_custo_totvs planifik" ON public.centros_custo_totvs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS cct_obra_idx ON public.centros_custo_totvs(obra_id);
CREATE INDEX IF NOT EXISTS cct_tipo_idx ON public.centros_custo_totvs(tipo);
DROP TRIGGER IF EXISTS cct_touch_updated_at ON public.centros_custo_totvs;
CREATE TRIGGER cct_touch_updated_at BEFORE UPDATE ON public.centros_custo_totvs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.custo_colaborador_competencia
  ADD COLUMN IF NOT EXISTS centro_custo_totvs_id UUID REFERENCES public.centros_custo_totvs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_custo_colab_cc_totvs ON public.custo_colaborador_competencia(centro_custo_totvs_id);

-- ============================================================
-- ONDA A-05: Tabelas filhas de obras
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cronograma_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0, descricao TEXT, uid_mpp TEXT,
  data_inicio DATE NOT NULL, data_fim DATE NOT NULL,
  data_inicio_baseline DATE, data_fim_baseline DATE,
  percentual_previsto NUMERIC(7,4) NOT NULL DEFAULT 0,
  percentual_realizado NUMERIC(7,4) NOT NULL DEFAULT 0,
  custo NUMERIC(14,2), custo_baseline NUMERIC(14,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cronograma_itens_pct_real_chk CHECK (percentual_realizado >= 0 AND percentual_realizado <= 100),
  CONSTRAINT cronograma_itens_pct_prev_chk CHECK (percentual_previsto >= 0 AND percentual_previsto <= 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_itens TO authenticated, anon;
GRANT ALL ON public.cronograma_itens TO service_role;
ALTER TABLE public.cronograma_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_itens planifik" ON public.cronograma_itens;
CREATE POLICY "cronograma_itens planifik" ON public.cronograma_itens FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_cronograma_itens_obra ON public.cronograma_itens(obra_id, ativo);
CREATE INDEX IF NOT EXISTS idx_crono_uid_mpp ON public.cronograma_itens(uid_mpp);
DROP TRIGGER IF EXISTS trg_bump_versao_crono ON public.cronograma_itens;
CREATE TRIGGER trg_bump_versao_crono BEFORE UPDATE ON public.cronograma_itens FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();
DROP TRIGGER IF EXISTS trg_crono_updated ON public.cronograma_itens;
CREATE TRIGGER trg_crono_updated BEFORE UPDATE ON public.cronograma_itens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.cronograma_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  motivo text NOT NULL CHECK (motivo IN ('import_inicial','aditivo','ajuste_manual')),
  observacoes text, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  UNIQUE (obra_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_baselines TO authenticated, anon;
GRANT ALL ON public.cronograma_baselines TO service_role;
ALTER TABLE public.cronograma_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_baselines planifik" ON public.cronograma_baselines;
CREATE POLICY "cronograma_baselines planifik" ON public.cronograma_baselines FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_baselines_obra ON public.cronograma_baselines(obra_id, versao DESC);

CREATE TABLE IF NOT EXISTS public.cronograma_item_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid NOT NULL REFERENCES public.cronograma_baselines(id) ON DELETE CASCADE,
  cronograma_item_id uuid NOT NULL, uid_mpp text, descricao text,
  custo NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_inicio date, data_fim date,
  percentual_previsto NUMERIC(7,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_item_baseline TO authenticated, anon;
GRANT ALL ON public.cronograma_item_baseline TO service_role;
ALTER TABLE public.cronograma_item_baseline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_item_baseline planifik" ON public.cronograma_item_baseline;
CREATE POLICY "cronograma_item_baseline planifik" ON public.cronograma_item_baseline FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cronograma_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL, data_corte DATE NOT NULL,
  arquivo_nome TEXT, observacoes TEXT,
  totais JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_revisoes TO authenticated, anon;
GRANT ALL ON public.cronograma_revisoes TO service_role;
ALTER TABLE public.cronograma_revisoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_revisoes planifik" ON public.cronograma_revisoes;
CREATE POLICY "cronograma_revisoes planifik" ON public.cronograma_revisoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cronograma_item_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL REFERENCES public.cronograma_revisoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID NOT NULL,
  data_inicio_anterior DATE, data_inicio_novo DATE,
  data_fim_anterior DATE, data_fim_novo DATE,
  percentual_realizado_anterior NUMERIC(7,4), percentual_realizado_novo NUMERIC(7,4),
  custo_anterior NUMERIC(14,2), custo_novo NUMERIC(14,2),
  tipo_mudanca TEXT NOT NULL, descricao_item TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_item_revisoes TO authenticated, anon;
GRANT ALL ON public.cronograma_item_revisoes TO service_role;
ALTER TABLE public.cronograma_item_revisoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_item_revisoes planifik" ON public.cronograma_item_revisoes;
CREATE POLICY "cronograma_item_revisoes planifik" ON public.cronograma_item_revisoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cronograma_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  item_id uuid NOT NULL, predecessor_uid_mpp text,
  tipo text NOT NULL DEFAULT 'FS', lag_dias integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_dependencias TO authenticated, anon;
GRANT ALL ON public.cronograma_dependencias TO service_role;
ALTER TABLE public.cronograma_dependencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_dependencias planifik" ON public.cronograma_dependencias;
CREATE POLICY "cronograma_dependencias planifik" ON public.cronograma_dependencias FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cronograma_marcos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome text NOT NULL, data_prevista date NOT NULL,
  data_baseline date, data_realizado date,
  tipo text NOT NULL DEFAULT 'marco', critico boolean NOT NULL DEFAULT false,
  observacoes text, ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_marcos TO authenticated, anon;
GRANT ALL ON public.cronograma_marcos TO service_role;
ALTER TABLE public.cronograma_marcos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cronograma_marcos planifik" ON public.cronograma_marcos;
CREATE POLICY "cronograma_marcos planifik" ON public.cronograma_marcos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_cronograma_marcos_updated_at ON public.cronograma_marcos;
CREATE TRIGGER trg_cronograma_marcos_updated_at BEFORE UPDATE ON public.cronograma_marcos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero TEXT NOT NULL, data_corte DATE NOT NULL, data_aprovacao DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0, percentual NUMERIC(7,4),
  status public.medicao_status NOT NULL DEFAULT 'rascunho',
  observacoes TEXT, arquivo_origem TEXT, sheet_origem TEXT,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated, anon;
GRANT ALL ON public.medicoes TO service_role;
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medicoes planifik" ON public.medicoes;
CREATE POLICY "medicoes planifik" ON public.medicoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra_status ON public.medicoes(obra_id, status);
DROP TRIGGER IF EXISTS trg_medicoes_updated ON public.medicoes;
CREATE TRIGGER trg_medicoes_updated BEFORE UPDATE ON public.medicoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bump_versao_medicoes ON public.medicoes;
CREATE TRIGGER trg_bump_versao_medicoes BEFORE UPDATE ON public.medicoes FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE IF NOT EXISTS public.itens_medicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID,
  percentual_anterior NUMERIC(7,4), percentual_atual NUMERIC(7,4),
  valor_anterior NUMERIC(14,2), valor_atual NUMERIC(14,2),
  bms_item_codigo TEXT, bms_descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT itens_medicao_pct_atual_chk CHECK (percentual_atual IS NULL OR (percentual_atual >= 0 AND percentual_atual <= 100)),
  CONSTRAINT itens_medicao_pct_anterior_chk CHECK (percentual_anterior IS NULL OR (percentual_anterior >= 0 AND percentual_anterior <= 100))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_medicao TO authenticated, anon;
GRANT ALL ON public.itens_medicao TO service_role;
ALTER TABLE public.itens_medicao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "itens_medicao planifik" ON public.itens_medicao;
CREATE POLICY "itens_medicao planifik" ON public.itens_medicao FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_itens_med_medicao ON public.itens_medicao(medicao_id);
CREATE INDEX IF NOT EXISTS idx_itens_med_crono ON public.itens_medicao(cronograma_item_id);

CREATE TABLE IF NOT EXISTS public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  medicao_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
  numero TEXT, data_emissao DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(14,2), valor_servicos NUMERIC(14,2),
  data_vencimento DATE,
  status public.nf_status NOT NULL DEFAULT 'emitida',
  pdf_url TEXT, observacoes TEXT,
  percentual_material NUMERIC, valor_material NUMERIC,
  inss_retido NUMERIC(14,2) NOT NULL DEFAULT 0,
  iss_retido NUMERIC(14,2) NOT NULL DEFAULT 0,
  outras_retencoes NUMERIC(14,2) NOT NULL DEFAULT 0,
  retencao_cbs NUMERIC(14,2) NOT NULL DEFAULT 0,
  retencao_ibs NUMERIC(14,2) NOT NULL DEFAULT 0,
  codigo_cno TEXT, codigo_art TEXT,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated, anon;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notas_fiscais planifik" ON public.notas_fiscais;
CREATE POLICY "notas_fiscais planifik" ON public.notas_fiscais FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_nfs_obra_status ON public.notas_fiscais(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_nfs_medicao ON public.notas_fiscais(medicao_id);
DROP TRIGGER IF EXISTS trg_nfs_updated ON public.notas_fiscais;
CREATE TRIGGER trg_nfs_updated BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bump_versao_nfs ON public.notas_fiscais;
CREATE TRIGGER trg_bump_versao_nfs BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE IF NOT EXISTS public.recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  cronograma_item_id UUID,
  data_prevista DATE NOT NULL, data_recebimento DATE,
  valor_previsto NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_previsto_inicial NUMERIC(14,2),
  valor_recebido NUMERIC(14,2),
  status public.recebimento_status NOT NULL DEFAULT 'previsto',
  congelado BOOLEAN NOT NULL DEFAULT false,
  origem TEXT NOT NULL DEFAULT 'manual',
  observacoes TEXT,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recebimentos TO authenticated, anon;
GRANT ALL ON public.recebimentos TO service_role;
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recebimentos planifik" ON public.recebimentos;
CREATE POLICY "recebimentos planifik" ON public.recebimentos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_receb_obra_data ON public.recebimentos(obra_id, data_prevista);
DROP TRIGGER IF EXISTS trg_receb_updated ON public.recebimentos;
CREATE TRIGGER trg_receb_updated BEFORE UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bump_versao_receb ON public.recebimentos;
CREATE TRIGGER trg_bump_versao_receb BEFORE UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE IF NOT EXISTS public.bms_previstas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  data_inicio_janela date NOT NULL, data_corte date NOT NULL,
  valor_previsto_inicial numeric(14,2) NOT NULL DEFAULT 0,
  valor_previsto_dinamico numeric(14,2) NOT NULL DEFAULT 0,
  valor_previsto_dinamico_pre_faturamento numeric(14,2),
  data_emissao_nfs_prevista date, data_pagamento_prevista date,
  status text NOT NULL DEFAULT 'prevista'
    CHECK (status IN ('prevista','aberta','fechada','faturada','paga','cancelada')),
  medicao_id uuid REFERENCES public.medicoes(id) ON DELETE SET NULL,
  nota_fiscal_id uuid REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  observacoes text,
  versao_otimista integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bms_previstas TO authenticated, anon;
GRANT ALL ON public.bms_previstas TO service_role;
ALTER TABLE public.bms_previstas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bms_previstas planifik" ON public.bms_previstas;
CREATE POLICY "bms_previstas planifik" ON public.bms_previstas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_bms_previstas_obra_status ON public.bms_previstas(obra_id, status);
DROP TRIGGER IF EXISTS trg_bms_previstas_touch ON public.bms_previstas;
CREATE TRIGGER trg_bms_previstas_touch BEFORE UPDATE ON public.bms_previstas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bms_previstas_versao ON public.bms_previstas;
CREATE TRIGGER trg_bms_previstas_versao BEFORE UPDATE ON public.bms_previstas FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();
DROP TRIGGER IF EXISTS trg_bms_previstas_audit ON public.bms_previstas;
CREATE TRIGGER trg_bms_previstas_audit AFTER INSERT OR UPDATE OR DELETE ON public.bms_previstas FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

CREATE TABLE IF NOT EXISTS public.bms_redistribuicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  bms_origem_numero integer NOT NULL, bms_destino_numero integer NOT NULL,
  cronograma_item_id uuid, descricao_item text,
  valor_atrasado numeric(14,2) NOT NULL DEFAULT 0,
  valor_absorvido numeric(14,2) NOT NULL DEFAULT 0,
  motivo text NOT NULL DEFAULT 'proporcional',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bms_redistribuicao TO authenticated, anon;
GRANT ALL ON public.bms_redistribuicao TO service_role;
ALTER TABLE public.bms_redistribuicao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bms_redistribuicao planifik" ON public.bms_redistribuicao;
CREATE POLICY "bms_redistribuicao planifik" ON public.bms_redistribuicao FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.aditivos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero text NOT NULL, tipo public.aditivo_tipo NOT NULL,
  valor_financeiro numeric(14,2) NOT NULL DEFAULT 0,
  dias_prazo integer NOT NULL DEFAULT 0,
  data_aprovacao date, documento_url text, observacoes text,
  status public.aditivo_status NOT NULL DEFAULT 'rascunho',
  baseline_id uuid REFERENCES public.cronograma_baselines(id),
  versao_otimista integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aditivos_contrato TO authenticated, anon;
GRANT ALL ON public.aditivos_contrato TO service_role;
ALTER TABLE public.aditivos_contrato ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aditivos_contrato planifik" ON public.aditivos_contrato;
CREATE POLICY "aditivos_contrato planifik" ON public.aditivos_contrato FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_aditivos_obra_status ON public.aditivos_contrato(obra_id, status);
DROP TRIGGER IF EXISTS trg_touch_aditivos ON public.aditivos_contrato;
CREATE TRIGGER trg_touch_aditivos BEFORE UPDATE ON public.aditivos_contrato FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_bump_versao_aditivos ON public.aditivos_contrato;
CREATE TRIGGER trg_bump_versao_aditivos BEFORE UPDATE ON public.aditivos_contrato FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE IF NOT EXISTS public.riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  codigo text, descricao text NOT NULL, categoria text, tipo text,
  probabilidade text, impacto text, impacto_financeiro numeric(14,2),
  status text NOT NULL DEFAULT 'aberto',
  responsavel text, resposta text, plano_resposta text, observacoes text,
  data_revisao date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.riscos TO authenticated, anon;
GRANT ALL ON public.riscos TO service_role;
ALTER TABLE public.riscos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "riscos planifik" ON public.riscos;
CREATE POLICY "riscos planifik" ON public.riscos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS riscos_obra_idx ON public.riscos(obra_id);
DROP TRIGGER IF EXISTS trg_riscos_updated ON public.riscos;
CREATE TRIGGER trg_riscos_updated BEFORE UPDATE ON public.riscos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL, descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status public.ocorrencia_status NOT NULL DEFAULT 'aberta',
  responsavel TEXT,
  risco_id UUID REFERENCES public.riscos(id) ON DELETE SET NULL,
  data_abertura DATE NOT NULL DEFAULT current_date,
  data_resolucao DATE, acao_corretiva TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias TO authenticated, anon;
GRANT ALL ON public.ocorrencias TO service_role;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ocorrencias planifik" ON public.ocorrencias;
CREATE POLICY "ocorrencias planifik" ON public.ocorrencias FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS ocorrencias_obra_idx ON public.ocorrencias(obra_id);
DROP TRIGGER IF EXISTS trg_ocorrencias_updated_at ON public.ocorrencias;
CREATE TRIGGER trg_ocorrencias_updated_at BEFORE UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.licoes_aprendidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  categoria TEXT, situacao TEXT NOT NULL, recomendacao TEXT NOT NULL, impacto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licoes_aprendidas TO authenticated, anon;
GRANT ALL ON public.licoes_aprendidas TO service_role;
ALTER TABLE public.licoes_aprendidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "licoes_aprendidas planifik" ON public.licoes_aprendidas;
CREATE POLICY "licoes_aprendidas planifik" ON public.licoes_aprendidas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS licoes_obra_idx ON public.licoes_aprendidas(obra_id);

-- ============================================================
-- ONDA A-06: financeiro_lancamentos / financeiro_rateios
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.financeiro_snapshots(id) ON DELETE CASCADE,
  ref_lancamento BIGINT NOT NULL,
  filial INT,
  centro_custo TEXT, desc_centro_custo TEXT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  natureza_tipo SMALLINT, status_cod SMALLINT, status_label TEXT,
  tipo_documento TEXT, numero_documento TEXT,
  cnpj_cpf TEXT, nome TEXT, nome_fantasia TEXT, cliente_fornecedor TEXT,
  valor_original NUMERIC NOT NULL DEFAULT 0,
  valor_desconto NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC NOT NULL DEFAULT 0,
  valor_baixado NUMERIC NOT NULL DEFAULT 0,
  data_emissao DATE, data_vencimento DATE, data_baixa DATE, data_pagamento DATE,
  dias_atraso INT, mes_competencia DATE, historico TEXT,
  centro_custo_tipo TEXT, categoria_indireta TEXT,
  origem TEXT NOT NULL DEFAULT 'totvs' CHECK (origem IN ('totvs','sistema')),
  solicitacao_id UUID REFERENCES public.solicitacoes_financeiras(id) ON DELETE SET NULL,
  conciliado BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated, anon;
GRANT ALL ON public.financeiro_lancamentos TO service_role;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fin_lancamentos planifik" ON public.financeiro_lancamentos;
CREATE POLICY "fin_lancamentos planifik" ON public.financeiro_lancamentos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS fin_lanc_snapshot_idx ON public.financeiro_lancamentos(snapshot_id);
CREATE INDEX IF NOT EXISTS fin_lanc_obra_idx ON public.financeiro_lancamentos(obra_id);
CREATE INDEX IF NOT EXISTS fin_lanc_cc_idx ON public.financeiro_lancamentos(centro_custo);
CREATE INDEX IF NOT EXISTS fin_lanc_origem_idx ON public.financeiro_lancamentos(origem);
CREATE INDEX IF NOT EXISTS fin_lanc_cc_tipo_idx ON public.financeiro_lancamentos(centro_custo_tipo);

CREATE TABLE IF NOT EXISTS public.financeiro_rateios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  cod_natureza TEXT, desc_natureza TEXT, grupo TEXT, subgrupo TEXT,
  valor_rateio NUMERIC NOT NULL DEFAULT 0, status_lancamento TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rateios TO authenticated, anon;
GRANT ALL ON public.financeiro_rateios TO service_role;
ALTER TABLE public.financeiro_rateios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fin_rateios planifik" ON public.financeiro_rateios;
CREATE POLICY "fin_rateios planifik" ON public.financeiro_rateios FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS fin_rateios_lanc_idx ON public.financeiro_rateios(lancamento_id);
CREATE INDEX IF NOT EXISTS fin_rateios_natureza_idx ON public.financeiro_rateios(cod_natureza);

-- ============================================================
-- ONDA A-07: Views e RPCs
-- ============================================================
CREATE OR REPLACE VIEW public.vw_nf_saldo
WITH (security_invoker = true) AS
SELECT nf.id AS nota_fiscal_id, nf.obra_id, nf.numero,
  COALESCE(nf.valor_liquido, nf.valor, 0) AS valor_liquido,
  COALESCE(SUM(CASE WHEN r.status::text NOT IN ('cancelado','previsto','a_receber','atrasado','inadimplente')
    THEN COALESCE(r.valor_recebido, 0) ELSE 0 END), 0) AS total_recebido,
  (COALESCE(nf.valor_liquido, nf.valor, 0) - COALESCE(SUM(CASE WHEN r.status::text NOT IN ('cancelado','previsto','a_receber','atrasado','inadimplente')
    THEN COALESCE(r.valor_recebido, 0) ELSE 0 END), 0)) AS saldo_aberto
FROM public.notas_fiscais nf
LEFT JOIN public.recebimentos r ON r.nota_fiscal_id = nf.id
GROUP BY nf.id;
GRANT SELECT ON public.vw_nf_saldo TO authenticated, anon;

CREATE OR REPLACE VIEW public.vw_obra_valores
WITH (security_invoker = true) AS
SELECT o.id AS obra_id,
  o.valor_contrato AS valor_contrato_original,
  (o.valor_contrato + COALESCE((SELECT SUM(a.valor_financeiro) FROM public.aditivos_contrato a
    WHERE a.obra_id = o.id AND a.status = 'aprovado'::aditivo_status), 0)) AS valor_contrato_atual,
  COALESCE((SELECT SUM(cib.custo) FROM public.cronograma_baselines b
    JOIN public.cronograma_item_baseline cib ON cib.baseline_id = b.id
    WHERE b.obra_id = o.id AND b.versao = (SELECT MAX(versao) FROM public.cronograma_baselines WHERE obra_id = o.id)), 0) AS valor_planejado_baseline,
  COALESCE((SELECT SUM(im.valor_atual) FROM public.itens_medicao im
    JOIN public.medicoes m ON m.id = im.medicao_id
    WHERE m.obra_id = o.id AND m.status::text IN ('aprovada','faturada')), 0) AS valor_executado,
  COALESCE((SELECT SUM(a.dias_prazo) FROM public.aditivos_contrato a
    WHERE a.obra_id = o.id AND a.status = 'aprovado'::aditivo_status), 0) AS dias_aditivos
FROM public.obras o;
GRANT SELECT ON public.vw_obra_valores TO authenticated, anon;

CREATE OR REPLACE VIEW public.vw_financeiro_obra
WITH (security_invoker = true) AS
WITH ultimo AS (SELECT id FROM public.financeiro_snapshots ORDER BY importado_em DESC LIMIT 1)
SELECT l.id AS lancamento_id, l.obra_id, o.nome AS obra_nome, o.codigo AS obra_codigo,
  l.centro_custo, l.desc_centro_custo, l.ref_lancamento, l.natureza_tipo,
  l.status_cod, l.status_label, l.nome AS contraparte, l.cliente_fornecedor,
  l.valor_liquido, l.valor_baixado, l.data_emissao, l.data_vencimento, l.data_pagamento,
  l.mes_competencia, l.origem,
  r.cod_natureza, r.desc_natureza, r.grupo, r.subgrupo, r.valor_rateio, r.status_lancamento
FROM public.financeiro_lancamentos l
JOIN ultimo u ON u.id = l.snapshot_id
LEFT JOIN public.obras o ON o.id = l.obra_id
LEFT JOIN public.financeiro_rateios r ON r.lancamento_id = l.id;
GRANT SELECT ON public.vw_financeiro_obra TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.fn_seed_plano_contas()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted INT := 0;
  v_seed TEXT[][] := ARRAY[
    ['1','RECEITAS'],['1.01','RECEITA PRESTACAO DE SERVIÇO'],
    ['1.01.001','Receita Prestação de Serviço'],['1.02','RECEITA DE VENDAS'],
    ['1.02.001','Venda de Materiais'],['1.02.002','Venda de Imobilizado'],
    ['1.03','ADIANTAMENTOS'],['1.03.001','Adiantamento de cliente'],
    ['1.04','OUTRAS RECEITAS'],['1.04.001','Aporte Financeiro'],['1.04.002','Reembolsos'],
    ['2','DESPESAS'],['2.01','PAGAMENTO AO FORNECEDOR'],
    ['2.01.001','Locação de Equipamentos e Maquinários'],['2.01.002','Lanches e Refeições'],
    ['2.01.003','Telecomunicação'],['2.01.004','Água'],['2.01.005','Energia Elétrica'],
    ['2.01.006','Gêneros Alimentícios, Material de Limpeza e Descartáveis'],
    ['2.01.007','Material de Escritório e Medicamentos'],
    ['2.01.008','Serviços de Consultoria, Treinamentos e Diversos'],
    ['2.01.009','Manutenção de Equipamentos'],['2.01.010','Materiais aplicados em Obras'],
    ['2.01.011','Serviços Aplicados em Obras'],['2.01.012','Materiais para Solda e Serralheria'],
    ['2.01.013','Locação de Imóveis'],['2.01.014','Locação de Veículos'],
    ['2.01.015','Hospedagem'],['2.01.016','Despesas Diversas'],
    ['2.01.017','Combustível, diesel e derivados do petroleo'],
    ['2.01.018','Pneus e Peças para Veículos'],['2.01.019','Manutenção de Veículos'],
    ['2.01.020','Materiais para Manutenção'],['2.01.021','Pedágios e Estacionamento'],
    ['2.01.022','Seguro de Vida, Veículos e Imóveis'],['2.01.023','Guarda Patrimonial'],
    ['2.01.024','Serviços de Concretagem'],['2.01.025','Ferramentas, EPIs e Vestuário'],
    ['2.01.026','Serviços de Cópias e Impressões'],['2.01.027','Serviços Médicos Ocupacionais'],
    ['2.01.028','Serviços de Tecnologia da Informação e Comunicação'],
    ['2.01.029','Taxa do CREA São Paulo'],['2.01.030','Despesa por Perda'],
    ['2.01.031','Material de Pintura (Inativado)'],['2.01.032','Material de Pintura'],
    ['2.01.033','Transporte e Passagens'],['2.01.034','Frete de Produtos e Máquinas'],
    ['2.01.035','Locação de Máquinas Pesadas'],['2.01.036','Publicidade e Propaganda'],
    ['2.01.037','Serviços Aplicados (Fora de Obra)'],
    ['2.02','PAGAMENTOS FOLHA'],['2.02.001','Salário'],['2.02.002','Férias'],
    ['2.02.003','13º Salário'],['2.02.004','Empréstimo Consignado Funcionários'],
    ['2.02.005','VA e VR'],['2.02.006','Rescisão'],['2.02.007','Comissão e Ajuda de Custo'],
    ['2.02.008','Encargos Processuais'],['2.02.009','Transferência para Sócios'],
    ['2.02.010','Plano Odontologico'],['2.02.011','Diária de Serviço Executado'],
    ['2.02.012','Vale-Alimentação'],['2.02.013','Vale-Refeição'],
    ['2.03','PAGAMENTO TAXAS E TRIBUTOS'],['2.03.001','INSS'],['2.03.002','IRRF PF'],
    ['2.03.003','IRRF PJ'],['2.03.004','ISS'],['2.03.005','PIS RF'],
    ['2.03.006','COFINS RF'],['2.03.007','CSLL RF'],['2.03.008','FGTS'],
    ['2.03.009','IPTU / LICENÇA DE FUNCIONAMENTO'],['2.03.010','IPVA e Licenciamento'],
    ['2.03.011','Multas de Transito'],['2.03.012','Simples Nacional'],
    ['2.03.013','Impostos Retidos de Fornecedores'],['2.03.014','Impostos Parcelados'],
    ['2.04','IMOBILIZADO'],['2.04.001','Veículos'],
    ['2.04.002','Maquinas e Equipamentos'],['2.04.003','Móveis e Utensílios'],
    ['3','MOVIMENTACOES FINANCEIRAS'],['3.01','MOVIMENTACOES FINANCEIRAS'],
    ['3.01.001','Transferência entre Contas'],['3.01.002','Despesas Bancárias'],
    ['3.01.003','Rendimento Aplicação'],
    ['3.01.004','Empréstimo Bancário/Pessoa Fisica/Aporte Financeiro Socios'],
    ['3.01.005','Antecipação de Recebíveis, GR e Outros'],
    ['3.01.006','Cartão de Crédito'],
    ['3.01.007','Financiamento de Veículos, Máquinas e Equipamentos'],
    ['3.01.008','Investimento Imobiliário'],['3.01.009','Consorcios']
  ];
  v_row TEXT[];
  v_cod TEXT; v_desc TEXT; v_parts TEXT[];
  v_nivel SMALLINT; v_pai TEXT; v_grupo TEXT; v_subgrupo TEXT;
BEGIN
  FOREACH v_row SLICE 1 IN ARRAY v_seed LOOP
    v_cod := v_row[1]; v_desc := v_row[2];
    v_parts := string_to_array(v_cod, '.');
    v_nivel := array_length(v_parts, 1)::SMALLINT;
    v_grupo := v_parts[1];
    v_subgrupo := CASE WHEN v_nivel >= 2 THEN v_parts[1]||'.'||v_parts[2] ELSE NULL END;
    v_pai := CASE WHEN v_nivel = 3 THEN v_parts[1]||'.'||v_parts[2]
                  WHEN v_nivel = 2 THEN v_parts[1] ELSE NULL END;
    INSERT INTO public.plano_contas (cod_natureza, descricao, nivel, cod_pai, grupo, subgrupo)
    VALUES (v_cod, v_desc, v_nivel, v_pai, v_grupo, v_subgrupo)
    ON CONFLICT (cod_natureza) DO NOTHING;
    IF FOUND THEN v_inserted := v_inserted + 1; END IF;
  END LOOP;
  RETURN v_inserted;
END $$;
GRANT EXECUTE ON FUNCTION public.fn_seed_plano_contas() TO authenticated, anon;

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