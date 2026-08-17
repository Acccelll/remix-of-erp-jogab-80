
ALTER TABLE public.mobilizacoes_periodos
  ALTER COLUMN obra_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS from_obra_id TEXT,
  ADD COLUMN IF NOT EXISTS from_obra_nome TEXT,
  ADD COLUMN IF NOT EXISTS data_mobilizacao DATE,
  ADD COLUMN IF NOT EXISTS usuario_id TEXT,
  ADD COLUMN IF NOT EXISTS usuario_nome TEXT,
  ADD COLUMN IF NOT EXISTS tipo_movimento TEXT,
  ADD COLUMN IF NOT EXISTS colaborador_nome TEXT,
  ADD COLUMN IF NOT EXISTS colaborador_matricula TEXT,
  ADD COLUMN IF NOT EXISTS colaborador_funcao TEXT;

CREATE INDEX IF NOT EXISTS idx_mob_periodos_data_mobilizacao
  ON public.mobilizacoes_periodos(data_mobilizacao);
