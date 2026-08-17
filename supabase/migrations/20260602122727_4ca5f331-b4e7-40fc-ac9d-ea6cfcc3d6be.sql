-- Coluna denormalizada de responsável atual
ALTER TABLE public.patrimonios ADD COLUMN IF NOT EXISTS responsavel_id text;

-- Tabela de períodos de responsabilidade
CREATE TABLE IF NOT EXISTS public.responsabilidades_patrimonios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patrimonio_id text NOT NULL,
  colaborador_id text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsabilidades_patrimonios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsabilidades_patrimonios TO authenticated;
GRANT ALL ON public.responsabilidades_patrimonios TO service_role;

ALTER TABLE public.responsabilidades_patrimonios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público responsabilidades_patrimonios"
ON public.responsabilidades_patrimonios
FOR ALL
USING (true)
WITH CHECK (true);

-- Índice único parcial: apenas um período aberto por patrimônio
CREATE UNIQUE INDEX IF NOT EXISTS uniq_responsabilidade_aberta
ON public.responsabilidades_patrimonios (patrimonio_id)
WHERE data_fim IS NULL;

CREATE INDEX IF NOT EXISTS idx_resp_pat_patrimonio ON public.responsabilidades_patrimonios (patrimonio_id);
CREATE INDEX IF NOT EXISTS idx_resp_pat_colaborador ON public.responsabilidades_patrimonios (colaborador_id);