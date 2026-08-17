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

ALTER TABLE public.fopag_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access fopag" ON public.fopag_entries FOR ALL USING (true) WITH CHECK (true);

-- Histórico Salarial
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

ALTER TABLE public.historico_salarial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access historico" ON public.historico_salarial FOR ALL USING (true) WITH CHECK (true);

-- Provisões
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

ALTER TABLE public.provisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access provisoes" ON public.provisoes FOR ALL USING (true) WITH CHECK (true);

-- 13º Salário
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

ALTER TABLE public.decimo_terceiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access decimo" ON public.decimo_terceiro FOR ALL USING (true) WITH CHECK (true);

-- Horas Extras
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

ALTER TABLE public.horas_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access horas_extras" ON public.horas_extras FOR ALL USING (true) WITH CHECK (true);