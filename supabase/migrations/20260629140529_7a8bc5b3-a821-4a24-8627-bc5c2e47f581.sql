CREATE TABLE IF NOT EXISTS public.totvs_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome text,
  arquivo_hash text,
  status text NOT NULL CHECK (status IN ('ok','parcial','erro')),
  total_recebidas int NOT NULL DEFAULT 0,
  total_processadas int NOT NULL DEFAULT 0,
  total_rejeitadas int NOT NULL DEFAULT 0,
  erros jsonb,
  snapshot_id uuid REFERENCES public.financeiro_snapshots(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.totvs_import_runs TO authenticated;
GRANT ALL ON public.totvs_import_runs TO service_role;

ALTER TABLE public.totvs_import_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth pode ler import runs" ON public.totvs_import_runs;
CREATE POLICY "auth pode ler import runs" ON public.totvs_import_runs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth pode registrar import runs" ON public.totvs_import_runs;
CREATE POLICY "auth pode registrar import runs" ON public.totvs_import_runs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_totvs_import_runs_created ON public.totvs_import_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_totvs_import_runs_status ON public.totvs_import_runs (status);