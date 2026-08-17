
-- Obras
CREATE TABLE public.obras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cliente TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  requer_integracao BOOLEAN NOT NULL DEFAULT false,
  integracao_info TEXT NOT NULL DEFAULT '',
  data_mobilizacao TEXT,
  data_desmobilizacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to obras"
  ON public.obras FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to colaboradores"
  ON public.colaboradores FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Funções
CREATE TABLE public.funcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  nrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to funcoes"
  ON public.funcoes FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Tipos de Documento
CREATE TABLE public.documento_tipos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  vencimento_meses INTEGER NOT NULL DEFAULT 12,
  aviso_dias INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documento_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to documento_tipos"
  ON public.documento_tipos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Patrimônios
CREATE TABLE public.patrimonios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  obra_atual_id TEXT,
  riscado BOOLEAN NOT NULL DEFAULT false,
  quebrado BOOLEAN NOT NULL DEFAULT false,
  alugado BOOLEAN NOT NULL DEFAULT false,
  mobilizacao_pendente JSONB,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patrimonios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to patrimonios"
  ON public.patrimonios FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Veículos
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
  mobilizacao_pendente JSONB,
  historico JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to veiculos"
  ON public.veiculos FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Players (usuários do sistema)
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  is_gm BOOLEAN NOT NULL DEFAULT false,
  acessos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to players"
  ON public.players FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
