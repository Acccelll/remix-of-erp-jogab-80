
CREATE TABLE public.import_validation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sistema text NOT NULL CHECK (sistema IN ('trello','cronograma','totvs','ponto','obras_csv')),
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  contagem_origem integer NOT NULL DEFAULT 0,
  contagem_destino integer NOT NULL DEFAULT 0,
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  amostra jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacoes text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_validation_runs_sistema ON public.import_validation_runs(sistema);
CREATE INDEX idx_import_validation_runs_obra ON public.import_validation_runs(obra_id);
CREATE INDEX idx_import_validation_runs_created_at ON public.import_validation_runs(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_validation_runs TO authenticated;
GRANT ALL ON public.import_validation_runs TO service_role;

ALTER TABLE public.import_validation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read"
  ON public.import_validation_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "auth insert own"
  ON public.import_validation_runs FOR INSERT
  TO authenticated
  WITH CHECK (criado_por = auth.uid() OR public.current_is_gm());

CREATE POLICY "gm update"
  ON public.import_validation_runs FOR UPDATE
  TO authenticated
  USING (public.current_is_gm())
  WITH CHECK (public.current_is_gm());

CREATE POLICY "gm delete"
  ON public.import_validation_runs FOR DELETE
  TO authenticated
  USING (public.current_is_gm());

CREATE TRIGGER trg_import_validation_runs_updated_at
  BEFORE UPDATE ON public.import_validation_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
