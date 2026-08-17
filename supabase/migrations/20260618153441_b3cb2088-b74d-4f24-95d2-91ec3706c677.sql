
-- Análise de Ponto + Homem/Hora

CREATE TABLE public.ponto_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome text NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  total_registros integer NOT NULL DEFAULT 0,
  total_colaboradores integer NOT NULL DEFAULT 0,
  importado_por text,
  importado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_importacoes TO anon, authenticated;
GRANT ALL ON public.ponto_importacoes TO service_role;
ALTER TABLE public.ponto_importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ponto_importacoes" ON public.ponto_importacoes
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ponto_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.ponto_importacoes(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  nome_csv text NOT NULL DEFAULT '',
  matricula_csv text,
  cpf_csv text,
  departamento_csv text,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  data date NOT NULL,
  horas_previstas_min integer NOT NULL DEFAULT 0,
  horas_trabalhadas_min integer NOT NULL DEFAULT 0,
  horas_falta_min integer NOT NULL DEFAULT 0,
  horas_extra_50_min integer NOT NULL DEFAULT 0,
  horas_extra_60_min integer NOT NULL DEFAULT 0,
  horas_extra_100_min integer NOT NULL DEFAULT 0,
  marcacao_invalida boolean NOT NULL DEFAULT false,
  falta boolean NOT NULL DEFAULT false,
  atestado boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_registros_importacao ON public.ponto_registros(importacao_id);
CREATE INDEX idx_ponto_registros_colab_data ON public.ponto_registros(colaborador_id, data);
CREATE INDEX idx_ponto_registros_obra_data ON public.ponto_registros(obra_id, data);
CREATE INDEX idx_ponto_registros_data ON public.ponto_registros(data);
CREATE INDEX idx_ponto_registros_falta ON public.ponto_registros(falta) WHERE falta;
CREATE INDEX idx_ponto_registros_he60 ON public.ponto_registros(horas_extra_60_min) WHERE horas_extra_60_min > 0;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_registros TO anon, authenticated;
GRANT ALL ON public.ponto_registros TO service_role;
ALTER TABLE public.ponto_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ponto_registros" ON public.ponto_registros
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ponto_tratativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES public.ponto_registros(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  motivo text,
  comentario text,
  tratado_por text,
  tratado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_tratativas_registro ON public.ponto_tratativas(registro_id);
CREATE INDEX idx_ponto_tratativas_status ON public.ponto_tratativas(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_tratativas TO anon, authenticated;
GRANT ALL ON public.ponto_tratativas TO service_role;
ALTER TABLE public.ponto_tratativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to ponto_tratativas" ON public.ponto_tratativas
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_ponto_tratativas_updated
BEFORE UPDATE ON public.ponto_tratativas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- View Homem/Hora mensal: agrega ponto por colaborador/obra/competência
CREATE OR REPLACE VIEW public.vw_homem_hora_mensal
WITH (security_invoker = true) AS
SELECT
  pr.colaborador_id,
  pr.obra_id,
  to_char(pr.data, 'YYYY-MM') AS competencia,
  COUNT(*)::int AS dias,
  SUM(pr.horas_previstas_min)::int AS horas_previstas_min,
  SUM(pr.horas_trabalhadas_min)::int AS horas_realizadas_min,
  SUM(pr.horas_falta_min)::int AS horas_falta_min,
  SUM(pr.horas_extra_50_min)::int AS horas_extra_50_min,
  SUM(pr.horas_extra_60_min)::int AS horas_extra_60_min,
  SUM(pr.horas_extra_100_min)::int AS horas_extra_100_min,
  SUM(pr.horas_extra_50_min + pr.horas_extra_60_min + pr.horas_extra_100_min)::int AS horas_extra_total_min,
  SUM(CASE WHEN pr.falta THEN 1 ELSE 0 END)::int AS dias_falta,
  SUM(CASE WHEN pr.marcacao_invalida THEN 1 ELSE 0 END)::int AS dias_marcacao_invalida
FROM public.ponto_registros pr
GROUP BY pr.colaborador_id, pr.obra_id, to_char(pr.data, 'YYYY-MM');

GRANT SELECT ON public.vw_homem_hora_mensal TO anon, authenticated, service_role;
