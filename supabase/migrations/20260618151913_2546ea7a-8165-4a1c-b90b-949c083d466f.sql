-- Folha de Pagamento
CREATE TABLE public.fopag_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id TEXT NOT NULL,
  competencia TEXT NOT NULL,
  evento TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'provento',
  origem TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'previsto',
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fopag_entries TO authenticated, anon;
GRANT ALL ON public.fopag_entries TO service_role;
ALTER TABLE public.fopag_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access fopag" ON public.fopag_entries FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.historico_salarial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id TEXT NOT NULL,
  vigencia TEXT NOT NULL,
  salario_anterior NUMERIC NOT NULL DEFAULT 0,
  salario_novo NUMERIC NOT NULL,
  motivo TEXT NOT NULL DEFAULT 'reajuste',
  cargo TEXT NOT NULL DEFAULT '',
  responsavel TEXT NOT NULL DEFAULT '',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_salarial TO authenticated, anon;
GRANT ALL ON public.historico_salarial TO service_role;
ALTER TABLE public.historico_salarial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access historico" ON public.historico_salarial FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.provisoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id TEXT NOT NULL,
  competencia TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'ferias',
  status TEXT NOT NULL DEFAULT 'prevista',
  valor NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provisoes TO authenticated, anon;
GRANT ALL ON public.provisoes TO service_role;
ALTER TABLE public.provisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access provisoes" ON public.provisoes FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.decimo_terceiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id TEXT NOT NULL,
  competencia TEXT NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'adiantamento',
  status TEXT NOT NULL DEFAULT 'previsto',
  valor NUMERIC NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'folha',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decimo_terceiro TO authenticated, anon;
GRANT ALL ON public.decimo_terceiro TO service_role;
ALTER TABLE public.decimo_terceiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access decimo" ON public.decimo_terceiro FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.horas_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id TEXT NOT NULL,
  competencia TEXT NOT NULL,
  obra_id TEXT,
  obra_nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'he_50',
  status TEXT NOT NULL DEFAULT 'pendente',
  quantidade_horas NUMERIC NOT NULL DEFAULT 0,
  valor_hora NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.horas_extras TO authenticated, anon;
GRANT ALL ON public.horas_extras TO service_role;
ALTER TABLE public.horas_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access horas_extras" ON public.horas_extras FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.mobilizacoes_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL,
  obra_id TEXT NOT NULL,
  obra_nome TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobilizacoes_periodos TO authenticated, anon;
GRANT ALL ON public.mobilizacoes_periodos TO service_role;
CREATE INDEX idx_mob_periodos_colab ON public.mobilizacoes_periodos(colaborador_id);
CREATE INDEX idx_mob_periodos_datas ON public.mobilizacoes_periodos(data_inicio, data_fim);
ALTER TABLE public.mobilizacoes_periodos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access mobilizacoes_periodos" ON public.mobilizacoes_periodos FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_folha_rateada(p_colaborador_id TEXT, p_obra_id TEXT)
RETURNS TABLE (competencia TEXT, provento_total NUMERIC, desconto_total NUMERIC)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH dias_por_obra AS (
    SELECT to_char(d.dia, 'YYYY-MM') AS comp, mp.obra_id AS oid, COUNT(*)::NUMERIC AS dias
    FROM public.mobilizacoes_periodos mp
    CROSS JOIN LATERAL generate_series(mp.data_inicio, COALESCE(mp.data_fim, CURRENT_DATE), '1 day'::interval) AS d(dia)
    WHERE mp.colaborador_id = p_colaborador_id
    GROUP BY comp, mp.obra_id
  ),
  dias_totais AS (SELECT comp, SUM(dias) AS total_dias FROM dias_por_obra GROUP BY comp),
  proporcao AS (
    SELECT dpo.comp, CASE WHEN dt.total_dias > 0 THEN dpo.dias / dt.total_dias ELSE 0 END AS fator
    FROM dias_por_obra dpo JOIN dias_totais dt ON dt.comp = dpo.comp
    WHERE dpo.oid = p_obra_id
  )
  SELECT fe.competencia,
    ROUND(SUM(CASE WHEN fe.tipo IN ('provento','base') THEN fe.valor ELSE 0 END) * COALESCE(p.fator, 0), 2),
    ROUND(SUM(CASE WHEN fe.tipo = 'desconto' THEN fe.valor ELSE 0 END) * COALESCE(p.fator, 0), 2)
  FROM public.fopag_entries fe
  LEFT JOIN proporcao p ON p.comp = fe.competencia
  WHERE fe.colaborador_id = p_colaborador_id
  GROUP BY fe.competencia, p.fator
  ORDER BY fe.competencia;
END;
$$;

CREATE TABLE public.formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pix',
  nome_cartao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formas_pagamento TO authenticated, anon;
GRANT ALL ON public.formas_pagamento TO service_role;
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access formas_pagamento" ON public.formas_pagamento FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.solicitacoes_financeiras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor TEXT NOT NULL DEFAULT '',
  valor NUMERIC NOT NULL DEFAULT 0,
  data_pagamento TEXT,
  prazo_estimado TEXT,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id),
  nivel_prioridade TEXT NOT NULL DEFAULT 'normal',
  condicao_pagamento TEXT,
  centro_custo_id TEXT,
  solicitante TEXT NOT NULL DEFAULT '',
  fornecedor TEXT,
  referencia TEXT,
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'em_analise',
  comentario_aprovacao TEXT,
  criado_por TEXT NOT NULL DEFAULT '',
  aprovado_por TEXT,
  data_aprovacao TIMESTAMPTZ,
  recusado_por TEXT,
  data_recusa TIMESTAMPTZ,
  cancelado_por TEXT,
  data_cancelamento TIMESTAMPTZ,
  pagamento_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_financeiras TO authenticated, anon;
GRANT ALL ON public.solicitacoes_financeiras TO service_role;
ALTER TABLE public.solicitacoes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access solicitacoes_financeiras" ON public.solicitacoes_financeiras FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.solicitacao_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_financeiras(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  texto TEXT NOT NULL,
  autor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacao_comentarios TO authenticated, anon;
GRANT ALL ON public.solicitacao_comentarios TO service_role;
ALTER TABLE public.solicitacao_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access solicitacao_comentarios" ON public.solicitacao_comentarios FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.controle_despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID REFERENCES public.solicitacoes_financeiras(id),
  data_compra TEXT,
  responsavel TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  centro_custo_id TEXT,
  fornecedor TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  parcelas INTEGER NOT NULL DEFAULT 1,
  cartao TEXT,
  log_alteracoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.controle_despesas TO authenticated, anon;
GRANT ALL ON public.controle_despesas TO service_role;
ALTER TABLE public.controle_despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access controle_despesas" ON public.controle_despesas FOR ALL USING (true) WITH CHECK (true);

-- Enums (criar antes de tabelas que os usam)
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

-- Obras
CREATE TABLE public.obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cliente TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  requer_integracao BOOLEAN NOT NULL DEFAULT false,
  integracao_info TEXT NOT NULL DEFAULT '',
  data_mobilizacao TEXT,
  data_desmobilizacao TEXT,
  cnpj TEXT,
  prazo_padrao_pagamento TEXT,
  dia_fixo_pagamento_1 TEXT,
  dia_fixo_pagamento_2 TEXT,
  data_corte_medicao_1 TEXT,
  data_corte_medicao_2 TEXT,
  observacao TEXT,
  observacoes TEXT,
  flowcast_id UUID,
  cliente_id UUID,
  codigo TEXT,
  codigo_totvs TEXT,
  centro_custo_totvs TEXT,
  pedido_contrato TEXT,
  local TEXT,
  valor_contrato NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual_antecipacao NUMERIC(5,2) DEFAULT 0,
  valor_antecipacao NUMERIC(14,2),
  data_inicio DATE,
  data_fim DATE,
  data_previsao_termino DATE,
  regra_medicao TEXT,
  prazo_emitir_nf_dias INTEGER,
  prazo_pagamento_dias INTEGER,
  dia_fixo_pagamento INTEGER,
  dias_fixos_pagamento INTEGER[] DEFAULT '{}',
  dias_corte_bms INTEGER[] DEFAULT '{}',
  dias_ate_emissao_nf INTEGER DEFAULT 5,
  status public.obra_status NOT NULL DEFAULT 'em_andamento',
  percentual_material NUMERIC NOT NULL DEFAULT 70,
  aliquota_iss NUMERIC NOT NULL DEFAULT 5,
  aliquota_inss NUMERIC NOT NULL DEFAULT 11,
  aliquota_cbs NUMERIC NOT NULL DEFAULT 0,
  aliquota_ibs NUMERIC NOT NULL DEFAULT 0,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated, anon;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to obras" ON public.obras FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX obras_centro_custo_totvs_uidx ON public.obras (centro_custo_totvs) WHERE centro_custo_totvs IS NOT NULL;
CREATE INDEX obras_cliente_id_idx ON public.obras (cliente_id);
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON public.obras FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Colaboradores
CREATE TABLE public.colaboradores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula TEXT NOT NULL,
  nome TEXT NOT NULL,
  genero TEXT NOT NULL DEFAULT '',
  cep TEXT NOT NULL DEFAULT '',
  endereco TEXT NOT NULL DEFAULT '',
  data_nascimento TEXT NOT NULL DEFAULT '',
  local_nascimento TEXT NOT NULL DEFAULT '',
  etnia TEXT NOT NULL DEFAULT '',
  estado_civil TEXT NOT NULL DEFAULT '',
  nome_conjuge TEXT NOT NULL DEFAULT '',
  nome_mae TEXT NOT NULL DEFAULT '',
  nome_pai TEXT NOT NULL DEFAULT '',
  nacionalidade TEXT NOT NULL DEFAULT '',
  rg TEXT NOT NULL DEFAULT '',
  data_emissao_rg TEXT NOT NULL DEFAULT '',
  orgao_emissor_rg TEXT NOT NULL DEFAULT '',
  uf_emissor_rg TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  data_emissao_cpf TEXT NOT NULL DEFAULT '',
  pis TEXT NOT NULL DEFAULT '',
  data_emissao_pis TEXT NOT NULL DEFAULT '',
  data_admissao TEXT NOT NULL DEFAULT '',
  funcao TEXT NOT NULL DEFAULT '',
  salario TEXT NOT NULL DEFAULT '0',
  forma_salario TEXT NOT NULL DEFAULT 'mensal',
  ativo BOOLEAN NOT NULL DEFAULT true,
  obra_atual_id TEXT,
  integracoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  documentos JSONB NOT NULL DEFAULT '[]'::jsonb,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  ferias JSONB NOT NULL DEFAULT '[]'::jsonb,
  mobilizacao_pendente JSONB,
  data_inativacao TEXT,
  motivo_inativacao TEXT,
  data_rescisao TEXT,
  banco TEXT,
  numero_banco TEXT,
  agencia TEXT,
  numero_conta TEXT,
  tipo_conta TEXT,
  tipo_chave_pix TEXT,
  chave_pix TEXT,
  responsabilidades JSONB DEFAULT '[]'::jsonb,
  status_especial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaboradores TO authenticated, anon;
GRANT ALL ON public.colaboradores TO service_role;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to colaboradores" ON public.colaboradores FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.funcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  nrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes TO authenticated, anon;
GRANT ALL ON public.funcoes TO service_role;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to funcoes" ON public.funcoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.documento_tipos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  vencimento_meses INTEGER NOT NULL DEFAULT 12,
  aviso_dias INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_tipos TO authenticated, anon;
GRANT ALL ON public.documento_tipos TO service_role;
ALTER TABLE public.documento_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to documento_tipos" ON public.documento_tipos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.patrimonios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  obra_atual_id TEXT,
  riscado BOOLEAN NOT NULL DEFAULT false,
  quebrado BOOLEAN NOT NULL DEFAULT false,
  alugado BOOLEAN NOT NULL DEFAULT false,
  sujo BOOLEAN NOT NULL DEFAULT false,
  em_manutencao BOOLEAN NOT NULL DEFAULT false,
  responsavel_id TEXT,
  mobilizacao_pendente JSONB,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patrimonios TO authenticated, anon;
GRANT ALL ON public.patrimonios TO service_role;
ALTER TABLE public.patrimonios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to patrimonios" ON public.patrimonios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.veiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Utilitário',
  ativo BOOLEAN NOT NULL DEFAULT true,
  obra_atual_id TEXT,
  riscado BOOLEAN NOT NULL DEFAULT false,
  quebrado BOOLEAN NOT NULL DEFAULT false,
  alugado BOOLEAN NOT NULL DEFAULT false,
  sujo BOOLEAN NOT NULL DEFAULT false,
  manutencao BOOLEAN NOT NULL DEFAULT false,
  mobilizacao_pendente JSONB,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated, anon;
GRANT ALL ON public.veiculos TO service_role;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to veiculos" ON public.veiculos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  is_gm BOOLEAN NOT NULL DEFAULT false,
  acessos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated, anon;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to players" ON public.players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.mobilizacoes_veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id TEXT NOT NULL,
  obra_id TEXT NOT NULL,
  obra_nome TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobilizacoes_veiculos TO authenticated, anon;
GRANT ALL ON public.mobilizacoes_veiculos TO service_role;
CREATE INDEX idx_mob_veiculos_veiculo ON public.mobilizacoes_veiculos(veiculo_id);
CREATE INDEX idx_mob_veiculos_datas ON public.mobilizacoes_veiculos(data_inicio, data_fim);
ALTER TABLE public.mobilizacoes_veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to mobilizacoes_veiculos" ON public.mobilizacoes_veiculos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.responsabilidades_patrimonios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patrimonio_id TEXT NOT NULL,
  colaborador_id TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsabilidades_patrimonios TO authenticated, anon;
GRANT ALL ON public.responsabilidades_patrimonios TO service_role;
ALTER TABLE public.responsabilidades_patrimonios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso público responsabilidades_patrimonios" ON public.responsabilidades_patrimonios FOR ALL USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX uniq_responsabilidade_aberta ON public.responsabilidades_patrimonios (patrimonio_id) WHERE data_fim IS NULL;
CREATE INDEX idx_resp_pat_patrimonio ON public.responsabilidades_patrimonios (patrimonio_id);
CREATE INDEX idx_resp_pat_colaborador ON public.responsabilidades_patrimonios (colaborador_id);

-- Clientes / Plano de Contas / Financeiro
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  prazo_pagamento_dias INTEGER,
  prazo_emitir_nf_dias INTEGER,
  dias_fixos_pagamento INTEGER[] NOT NULL DEFAULT '{}',
  dia_fixo_pagamento INTEGER,
  percentual_material NUMERIC,
  aliquota_iss NUMERIC,
  aliquota_inss NUMERIC,
  aliquota_cbs NUMERIC,
  aliquota_ibs NUMERIC,
  observacoes TEXT,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated, anon;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes planifik" ON public.clientes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.obras ADD CONSTRAINT obras_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE TABLE public.plano_contas (
  cod_natureza TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  nivel SMALLINT NOT NULL,
  cod_pai TEXT,
  grupo TEXT NOT NULL,
  subgrupo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plano_contas TO authenticated, anon;
GRANT ALL ON public.plano_contas TO service_role;
ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plano_contas planifik" ON public.plano_contas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.financeiro_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  periodo_ref TEXT,
  nome_arquivo_titulos TEXT,
  nome_arquivo_rateios TEXT,
  total_titulos INT NOT NULL DEFAULT 0,
  total_rateios INT NOT NULL DEFAULT 0,
  total_valor NUMERIC NOT NULL DEFAULT 0,
  titulos_sem_obra INT NOT NULL DEFAULT 0,
  owner_id UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_snapshots TO authenticated, anon;
GRANT ALL ON public.financeiro_snapshots TO service_role;
ALTER TABLE public.financeiro_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_snapshots planifik" ON public.financeiro_snapshots FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.centros_custo_totvs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('obra','indireto')),
  categoria TEXT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((tipo = 'obra' AND obra_id IS NOT NULL AND categoria IS NULL) OR (tipo = 'indireto' AND categoria IS NOT NULL AND obra_id IS NULL)),
  CONSTRAINT centros_custo_totvs_owner_codigo_key UNIQUE (owner_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo_totvs TO authenticated, anon;
GRANT ALL ON public.centros_custo_totvs TO service_role;
ALTER TABLE public.centros_custo_totvs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "centros_custo_totvs planifik" ON public.centros_custo_totvs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX cct_obra_idx ON public.centros_custo_totvs(obra_id);
CREATE INDEX cct_tipo_idx ON public.centros_custo_totvs(tipo);
CREATE TRIGGER cct_touch_updated_at BEFORE UPDATE ON public.centros_custo_totvs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.custo_colaborador_competencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id TEXT NOT NULL,
  cpf TEXT NOT NULL,
  competencia TEXT NOT NULL,
  cargo_lido TEXT,
  matricula_lida TEXT,
  centro_custo_id TEXT,
  centro_custo_nome TEXT,
  centro_custo_totvs_id UUID REFERENCES public.centros_custo_totvs(id) ON DELETE SET NULL,
  proventos NUMERIC NOT NULL DEFAULT 0,
  horas_extras NUMERIC NOT NULL DEFAULT 0,
  inss_empresa NUMERIC NOT NULL DEFAULT 0,
  rat NUMERIC NOT NULL DEFAULT 0,
  inss_terceiros NUMERIC NOT NULL DEFAULT 0,
  fgts NUMERIC NOT NULL DEFAULT 0,
  provisao_13 NUMERIC NOT NULL DEFAULT 0,
  inss_provisao_13 NUMERIC NOT NULL DEFAULT 0,
  fgts_provisao_13 NUMERIC NOT NULL DEFAULT 0,
  provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  inss_provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  fgts_provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC GENERATED ALWAYS AS (proventos + inss_empresa + rat + inss_terceiros + fgts + provisao_13 + provisao_ferias) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custo_colaborador_competencia TO authenticated, anon;
GRANT ALL ON public.custo_colaborador_competencia TO service_role;
ALTER TABLE public.custo_colaborador_competencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access custo_colaborador_competencia" ON public.custo_colaborador_competencia FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
CREATE INDEX idx_custo_colab_competencia_comp ON public.custo_colaborador_competencia(competencia);
CREATE INDEX idx_custo_colab_competencia_colab ON public.custo_colaborador_competencia(colaborador_id);
CREATE INDEX idx_custo_colab_cc_totvs ON public.custo_colaborador_competencia(centro_custo_totvs_id);
CREATE TRIGGER trg_update_custo_colab_updated_at BEFORE UPDATE ON public.custo_colaborador_competencia FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.dp_holerite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'holerite' CHECK (tipo IN ('holerite','adiantamento')),
  colaborador_id TEXT,
  cpf TEXT NOT NULL,
  competencia TEXT NOT NULL,
  nome_lido TEXT,
  matricula_lida TEXT,
  cargo_lido TEXT,
  centro_custo_nome_lido TEXT,
  admissao DATE,
  proventos NUMERIC NOT NULL DEFAULT 0,
  descontos NUMERIC NOT NULL DEFAULT 0,
  liquido NUMERIC NOT NULL DEFAULT 0,
  base_inss NUMERIC NOT NULL DEFAULT 0,
  inss NUMERIC NOT NULL DEFAULT 0,
  base_irrf NUMERIC NOT NULL DEFAULT 0,
  irrf NUMERIC NOT NULL DEFAULT 0,
  base_fgts NUMERIC NOT NULL DEFAULT 0,
  fgts NUMERIC NOT NULL DEFAULT 0,
  provisao_13 NUMERIC NOT NULL DEFAULT 0,
  inss_provisao_13 NUMERIC NOT NULL DEFAULT 0,
  fgts_provisao_13 NUMERIC NOT NULL DEFAULT 0,
  provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  inss_provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  fgts_provisao_ferias NUMERIC NOT NULL DEFAULT 0,
  inss_empresa NUMERIC NOT NULL DEFAULT 0,
  rat NUMERIC NOT NULL DEFAULT 0,
  inss_terceiros NUMERIC NOT NULL DEFAULT 0,
  salario_base NUMERIC NOT NULL DEFAULT 0,
  horas_extras_valor NUMERIC NOT NULL DEFAULT 0,
  custo_total NUMERIC GENERATED ALWAYS AS (proventos + inss_empresa + rat + inss_terceiros + fgts + provisao_13 + provisao_ferias) STORED,
  fator_k NUMERIC GENERATED ALWAYS AS (CASE WHEN salario_base > 0 THEN (proventos + inss_empresa + rat + inss_terceiros + fgts + provisao_13 + provisao_ferias) / salario_base ELSE NULL END) STORED,
  verbas JSONB NOT NULL DEFAULT '[]'::jsonb,
  origem TEXT NOT NULL DEFAULT 'holerite_xls',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dp_holerite_cpf_competencia_tipo_key UNIQUE (cpf, competencia, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dp_holerite TO authenticated, anon;
GRANT ALL ON public.dp_holerite TO service_role;
ALTER TABLE public.dp_holerite ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dp_holerite full access" ON public.dp_holerite FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_dp_holerite_competencia ON public.dp_holerite(competencia);
CREATE INDEX idx_dp_holerite_colaborador ON public.dp_holerite(colaborador_id);
CREATE INDEX idx_dp_holerite_cpf_comp ON public.dp_holerite(cpf, competencia);
CREATE INDEX idx_dp_holerite_centro ON public.dp_holerite(centro_custo_nome_lido);
CREATE INDEX idx_dp_holerite_cargo ON public.dp_holerite(cargo_lido);
CREATE INDEX idx_dp_holerite_tipo ON public.dp_holerite(tipo);
CREATE TRIGGER trg_dp_holerite_updated_at BEFORE UPDATE ON public.dp_holerite FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID,
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('insert','update','delete','approve','cancel')),
  before JSONB,
  after JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated, anon;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs planifik" ON public.audit_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_audit_logs_obra ON public.audit_logs(obra_id, created_at DESC);
CREATE INDEX idx_audit_logs_entidade ON public.audit_logs(entidade, entidade_id);

CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_obra_id UUID; v_acao TEXT; v_before JSONB; v_after JSONB; v_entidade_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN v_acao := 'insert'; v_before := NULL; v_after := to_jsonb(NEW); v_entidade_id := NEW.id;
  ELSIF (TG_OP = 'UPDATE') THEN v_acao := 'update'; v_before := to_jsonb(OLD); v_after := to_jsonb(NEW); v_entidade_id := NEW.id;
  ELSE v_acao := 'delete'; v_before := to_jsonb(OLD); v_after := NULL; v_entidade_id := OLD.id; END IF;
  BEGIN v_obra_id := CASE
    WHEN TG_TABLE_NAME = 'obras' THEN v_entidade_id
    ELSE (CASE WHEN TG_OP = 'DELETE' THEN (v_before->>'obra_id')::UUID ELSE (v_after->>'obra_id')::UUID END)
  END; EXCEPTION WHEN OTHERS THEN v_obra_id := NULL; END;
  INSERT INTO public.audit_logs(obra_id, entidade, entidade_id, acao, before, after)
  VALUES (v_obra_id, TG_TABLE_NAME, v_entidade_id, v_acao, v_before, v_after);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM PUBLIC, anon, authenticated;

-- Cronograma
CREATE TABLE public.cronograma_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  uid_mpp TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_inicio_baseline DATE,
  data_fim_baseline DATE,
  percentual_previsto NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (percentual_previsto >= 0 AND percentual_previsto <= 100),
  percentual_realizado NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (percentual_realizado >= 0 AND percentual_realizado <= 100),
  custo NUMERIC(14,2),
  custo_baseline NUMERIC(14,2),
  folga_dias INTEGER,
  critico BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_itens TO authenticated, anon;
GRANT ALL ON public.cronograma_itens TO service_role;
ALTER TABLE public.cronograma_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_itens planifik" ON public.cronograma_itens FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_cronograma_itens_obra ON public.cronograma_itens(obra_id, ativo);
CREATE INDEX idx_crono_uid_mpp ON public.cronograma_itens(uid_mpp);
CREATE TRIGGER trg_bump_versao_crono BEFORE UPDATE ON public.cronograma_itens FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();
CREATE TRIGGER trg_crono_updated BEFORE UPDATE ON public.cronograma_itens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cronograma_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('import_inicial','aditivo','ajuste_manual')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (obra_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_baselines TO authenticated, anon;
GRANT ALL ON public.cronograma_baselines TO service_role;
ALTER TABLE public.cronograma_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_baselines planifik" ON public.cronograma_baselines FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_baselines_obra ON public.cronograma_baselines(obra_id, versao DESC);

CREATE TABLE public.cronograma_item_baseline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id UUID NOT NULL REFERENCES public.cronograma_baselines(id) ON DELETE CASCADE,
  cronograma_item_id UUID NOT NULL,
  uid_mpp TEXT,
  descricao TEXT,
  custo NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  percentual_previsto NUMERIC(7,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_item_baseline TO authenticated, anon;
GRANT ALL ON public.cronograma_item_baseline TO service_role;
ALTER TABLE public.cronograma_item_baseline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_item_baseline planifik" ON public.cronograma_item_baseline FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.cronograma_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  data_corte DATE NOT NULL,
  arquivo_nome TEXT,
  observacoes TEXT,
  baseline_id UUID REFERENCES public.cronograma_baselines(id) ON DELETE SET NULL,
  totais JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_revisoes TO authenticated, anon;
GRANT ALL ON public.cronograma_revisoes TO service_role;
ALTER TABLE public.cronograma_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_revisoes planifik" ON public.cronograma_revisoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.cronograma_item_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL REFERENCES public.cronograma_revisoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID NOT NULL,
  data_inicio_anterior DATE,
  data_inicio_novo DATE,
  data_fim_anterior DATE,
  data_fim_novo DATE,
  percentual_realizado_anterior NUMERIC(7,4),
  percentual_realizado_novo NUMERIC(7,4),
  custo_anterior NUMERIC(14,2),
  custo_novo NUMERIC(14,2),
  tipo_mudanca TEXT NOT NULL,
  descricao_item TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_item_revisoes TO authenticated, anon;
GRANT ALL ON public.cronograma_item_revisoes TO service_role;
ALTER TABLE public.cronograma_item_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_item_revisoes planifik" ON public.cronograma_item_revisoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.cronograma_dependencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  predecessor_uid_mpp TEXT,
  tipo TEXT NOT NULL DEFAULT 'FS',
  lag_dias INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_dependencias TO authenticated, anon;
GRANT ALL ON public.cronograma_dependencias TO service_role;
ALTER TABLE public.cronograma_dependencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_dependencias planifik" ON public.cronograma_dependencias FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.cronograma_marcos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data_prevista DATE NOT NULL,
  data_baseline DATE,
  data_realizado DATE,
  tipo TEXT NOT NULL DEFAULT 'marco',
  critico BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_marcos TO authenticated, anon;
GRANT ALL ON public.cronograma_marcos TO service_role;
ALTER TABLE public.cronograma_marcos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cronograma_marcos planifik" ON public.cronograma_marcos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_cronograma_marcos_updated_at BEFORE UPDATE ON public.cronograma_marcos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  data_corte DATE NOT NULL,
  data_inicio DATE,
  data_aprovacao DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual NUMERIC(7,4),
  status public.medicao_status NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  arquivo_origem TEXT,
  sheet_origem TEXT,
  baseline_id UUID REFERENCES public.cronograma_baselines(id),
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated, anon;
GRANT ALL ON public.medicoes TO service_role;
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicoes planifik" ON public.medicoes FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_medicoes_obra_status ON public.medicoes(obra_id, status);
CREATE INDEX idx_medicoes_baseline ON public.medicoes(baseline_id);
CREATE TRIGGER trg_medicoes_updated BEFORE UPDATE ON public.medicoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bump_versao_medicoes BEFORE UPDATE ON public.medicoes FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE public.itens_medicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID,
  percentual_anterior NUMERIC(7,4) CHECK (percentual_anterior IS NULL OR (percentual_anterior >= 0 AND percentual_anterior <= 100)),
  percentual_atual NUMERIC(7,4) CHECK (percentual_atual IS NULL OR (percentual_atual >= 0 AND percentual_atual <= 100)),
  valor_anterior NUMERIC(14,2),
  valor_atual NUMERIC(14,2),
  bms_item_codigo TEXT,
  bms_descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_medicao TO authenticated, anon;
GRANT ALL ON public.itens_medicao TO service_role;
ALTER TABLE public.itens_medicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens_medicao planifik" ON public.itens_medicao FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_itens_med_medicao ON public.itens_medicao(medicao_id);
CREATE INDEX idx_itens_med_crono ON public.itens_medicao(cronograma_item_id);

CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  medicao_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
  numero TEXT,
  data_emissao DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_liquido NUMERIC(14,2),
  valor_servicos NUMERIC(14,2),
  data_vencimento DATE,
  competencia DATE,
  status public.nf_status NOT NULL DEFAULT 'emitida',
  pdf_url TEXT,
  observacoes TEXT,
  percentual_material NUMERIC,
  valor_material NUMERIC,
  inss_retido NUMERIC(14,2) NOT NULL DEFAULT 0,
  iss_retido NUMERIC(14,2) NOT NULL DEFAULT 0,
  outras_retencoes NUMERIC(14,2) NOT NULL DEFAULT 0,
  retencao_cbs NUMERIC(14,2) NOT NULL DEFAULT 0,
  retencao_ibs NUMERIC(14,2) NOT NULL DEFAULT 0,
  codigo_cno TEXT,
  codigo_art TEXT,
  codigo_verificacao TEXT,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated, anon;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_fiscais planifik" ON public.notas_fiscais FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_nfs_obra_status ON public.notas_fiscais(obra_id, status);
CREATE INDEX idx_nfs_medicao ON public.notas_fiscais(medicao_id);
CREATE TRIGGER trg_nfs_updated BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bump_versao_nfs BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE public.recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  cronograma_item_id UUID,
  data_prevista DATE NOT NULL,
  data_recebimento DATE,
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
CREATE POLICY "recebimentos planifik" ON public.recebimentos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_receb_obra_data ON public.recebimentos(obra_id, data_prevista);
CREATE TRIGGER trg_receb_updated BEFORE UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bump_versao_receb BEFORE UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE public.bms_previstas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  data_inicio_janela DATE NOT NULL,
  data_corte DATE NOT NULL,
  valor_previsto_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_previsto_dinamico NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_previsto_dinamico_pre_faturamento NUMERIC(14,2),
  data_emissao_nfs_prevista DATE,
  data_pagamento_prevista DATE,
  status TEXT NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista','aberta','fechada','faturada','paga','cancelada')),
  medicao_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  observacoes TEXT,
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bms_previstas TO authenticated, anon;
GRANT ALL ON public.bms_previstas TO service_role;
ALTER TABLE public.bms_previstas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bms_previstas planifik" ON public.bms_previstas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_bms_previstas_obra_status ON public.bms_previstas(obra_id, status);
CREATE TRIGGER trg_bms_previstas_touch BEFORE UPDATE ON public.bms_previstas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bms_previstas_versao BEFORE UPDATE ON public.bms_previstas FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();
CREATE TRIGGER trg_bms_previstas_audit AFTER INSERT OR UPDATE OR DELETE ON public.bms_previstas FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();

CREATE TABLE public.bms_redistribuicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  bms_origem_numero INTEGER NOT NULL,
  bms_destino_numero INTEGER NOT NULL,
  cronograma_item_id UUID,
  descricao_item TEXT,
  valor_atrasado NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_absorvido NUMERIC(14,2) NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL DEFAULT 'proporcional',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bms_redistribuicao TO authenticated, anon;
GRANT ALL ON public.bms_redistribuicao TO service_role;
ALTER TABLE public.bms_redistribuicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bms_redistribuicao planifik" ON public.bms_redistribuicao FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

CREATE TABLE public.aditivos_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  tipo public.aditivo_tipo NOT NULL,
  valor_financeiro NUMERIC(14,2) NOT NULL DEFAULT 0,
  dias_prazo INTEGER NOT NULL DEFAULT 0,
  data_aprovacao DATE,
  documento_url TEXT,
  observacoes TEXT,
  status public.aditivo_status NOT NULL DEFAULT 'rascunho',
  baseline_id UUID REFERENCES public.cronograma_baselines(id),
  versao_otimista INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aditivos_contrato TO authenticated, anon;
GRANT ALL ON public.aditivos_contrato TO service_role;
ALTER TABLE public.aditivos_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aditivos_contrato planifik" ON public.aditivos_contrato FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX idx_aditivos_obra_status ON public.aditivos_contrato(obra_id, status);
CREATE TRIGGER trg_touch_aditivos BEFORE UPDATE ON public.aditivos_contrato FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_bump_versao_aditivos BEFORE UPDATE ON public.aditivos_contrato FOR EACH ROW EXECUTE FUNCTION public.fn_bump_versao_otimista();

CREATE TABLE public.riscos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  codigo TEXT,
  descricao TEXT NOT NULL,
  categoria TEXT,
  tipo TEXT,
  probabilidade INTEGER,
  impacto INTEGER,
  impacto_financeiro NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'aberto',
  responsavel TEXT,
  resposta TEXT,
  plano_resposta TEXT,
  observacoes TEXT,
  data_revisao DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.riscos TO authenticated, anon;
GRANT ALL ON public.riscos TO service_role;
ALTER TABLE public.riscos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "riscos planifik" ON public.riscos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX riscos_obra_idx ON public.riscos(obra_id);
CREATE TRIGGER trg_riscos_updated BEFORE UPDATE ON public.riscos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media',
  status public.ocorrencia_status NOT NULL DEFAULT 'aberta',
  responsavel TEXT,
  risco_id UUID REFERENCES public.riscos(id) ON DELETE SET NULL,
  data_abertura DATE NOT NULL DEFAULT current_date,
  data_resolucao DATE,
  acao_corretiva TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocorrencias TO authenticated, anon;
GRANT ALL ON public.ocorrencias TO service_role;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ocorrencias planifik" ON public.ocorrencias FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX ocorrencias_obra_idx ON public.ocorrencias(obra_id);
CREATE TRIGGER trg_ocorrencias_updated_at BEFORE UPDATE ON public.ocorrencias FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.licoes_aprendidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  categoria TEXT,
  situacao TEXT NOT NULL,
  recomendacao TEXT NOT NULL,
  impacto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licoes_aprendidas TO authenticated, anon;
GRANT ALL ON public.licoes_aprendidas TO service_role;
ALTER TABLE public.licoes_aprendidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "licoes_aprendidas planifik" ON public.licoes_aprendidas FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX licoes_obra_idx ON public.licoes_aprendidas(obra_id);

CREATE TABLE public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES public.financeiro_snapshots(id) ON DELETE CASCADE,
  ref_lancamento BIGINT NOT NULL,
  filial INT,
  centro_custo TEXT,
  desc_centro_custo TEXT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE SET NULL,
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
  centro_custo_tipo TEXT,
  categoria_indireta TEXT,
  origem TEXT NOT NULL DEFAULT 'totvs' CHECK (origem IN ('totvs','sistema')),
  solicitacao_id UUID REFERENCES public.solicitacoes_financeiras(id) ON DELETE SET NULL,
  conciliado BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated, anon;
GRANT ALL ON public.financeiro_lancamentos TO service_role;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_lancamentos planifik" ON public.financeiro_lancamentos FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX fin_lanc_snapshot_idx ON public.financeiro_lancamentos(snapshot_id);
CREATE INDEX fin_lanc_obra_idx ON public.financeiro_lancamentos(obra_id);
CREATE INDEX fin_lanc_cc_idx ON public.financeiro_lancamentos(centro_custo);
CREATE INDEX fin_lanc_origem_idx ON public.financeiro_lancamentos(origem);
CREATE INDEX fin_lanc_cc_tipo_idx ON public.financeiro_lancamentos(centro_custo_tipo);

CREATE TABLE public.financeiro_rateios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id UUID NOT NULL REFERENCES public.financeiro_lancamentos(id) ON DELETE CASCADE,
  cod_natureza TEXT,
  desc_natureza TEXT,
  grupo TEXT,
  subgrupo TEXT,
  valor_rateio NUMERIC NOT NULL DEFAULT 0,
  status_lancamento TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_rateios TO authenticated, anon;
GRANT ALL ON public.financeiro_rateios TO service_role;
ALTER TABLE public.financeiro_rateios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_rateios planifik" ON public.financeiro_rateios FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE INDEX fin_rateios_lanc_idx ON public.financeiro_rateios(lancamento_id);
CREATE INDEX fin_rateios_natureza_idx ON public.financeiro_rateios(cod_natureza);

-- Views
CREATE OR REPLACE VIEW public.vw_nf_saldo WITH (security_invoker = true) AS
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

CREATE OR REPLACE VIEW public.vw_obra_valores WITH (security_invoker = true) AS
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

CREATE OR REPLACE VIEW public.vw_financeiro_obra WITH (security_invoker = true) AS
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

-- RPCs auxiliares
CREATE OR REPLACE FUNCTION public.fn_recalcular_previsao_nf(p_obra_id UUID, p_valor_contrato NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_faturado NUMERIC := 0; v_saldo NUMERIC := 0; v_soma_prev NUMERIC := 0; v_count INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(valor),0) INTO v_faturado FROM public.notas_fiscais
  WHERE obra_id = p_obra_id AND COALESCE(status::text,'') <> 'cancelada';
  v_saldo := COALESCE(p_valor_contrato,0) - v_faturado;
  SELECT COALESCE(SUM(valor_previsto_dinamico),0), COUNT(*) INTO v_soma_prev, v_count
  FROM public.bms_previstas WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista';
  IF v_count = 0 THEN RETURN; END IF;
  IF v_soma_prev > 0 THEN
    UPDATE public.bms_previstas SET valor_previsto_dinamico = ROUND(valor_previsto_dinamico * v_saldo / v_soma_prev, 2)
    WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista';
  ELSE
    UPDATE public.bms_previstas SET valor_previsto_dinamico = ROUND(v_saldo / v_count, 2)
    WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_recalcular_apos_faturamento(p_obra_id UUID, p_nf_id UUID, p_valor_contrato NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_valor_faturado NUMERIC := 0; v_atualizadas INTEGER := 0;
BEGIN
  SELECT COALESCE(valor,0) INTO v_valor_faturado FROM public.notas_fiscais WHERE id = p_nf_id;
  PERFORM public.fn_recalcular_previsao_nf(p_obra_id, p_valor_contrato);
  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;
  RETURN jsonb_build_object('futuras_atualizadas', v_atualizadas, 'valor_faturado', v_valor_faturado);
END $$;

CREATE OR REPLACE FUNCTION public.fn_reverter_faturamento_bms(p_obra_id UUID, p_bms_id UUID, p_valor_contrato NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.fn_recalcular_previsao_nf(p_obra_id, p_valor_contrato); END $$;