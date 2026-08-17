
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_gm_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_gm FROM public.profiles WHERE id = _user_id LIMIT 1), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_gm_user(UUID) TO authenticated, anon, service_role;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key TEXT NOT NULL,
  obra_id UUID NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flag_key, obra_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feature_flags_select_authenticated" ON public.feature_flags;
CREATE POLICY "feature_flags_select_authenticated" ON public.feature_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "feature_flags_write_gm" ON public.feature_flags;
CREATE POLICY "feature_flags_write_gm" ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_gm_user(auth.uid())) WITH CHECK (public.is_gm_user(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_feature_flags_lookup ON public.feature_flags(flag_key, obra_id);
DROP TRIGGER IF EXISTS trg_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER trg_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_flag_enabled(_obra_id UUID, _flag_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.feature_flags WHERE flag_key = _flag_key AND obra_id = _obra_id LIMIT 1),
    (SELECT enabled FROM public.feature_flags WHERE flag_key = _flag_key AND obra_id IS NULL LIMIT 1),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_flag_enabled(UUID, TEXT) TO authenticated, anon, service_role;

CREATE TABLE IF NOT EXISTS public.import_validation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sistema TEXT NOT NULL CHECK (sistema IN ('trello','cronograma','totvs','ponto')),
  obra_id UUID NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  contagem_origem INTEGER NOT NULL DEFAULT 0,
  contagem_destino INTEGER NOT NULL DEFAULT 0,
  divergencias JSONB NOT NULL DEFAULT '[]'::jsonb,
  amostra JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_validation_runs TO authenticated;
GRANT ALL ON public.import_validation_runs TO service_role;
ALTER TABLE public.import_validation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ivr_select_authenticated" ON public.import_validation_runs;
CREATE POLICY "ivr_select_authenticated" ON public.import_validation_runs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ivr_insert_authenticated" ON public.import_validation_runs;
CREATE POLICY "ivr_insert_authenticated" ON public.import_validation_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por);
DROP POLICY IF EXISTS "ivr_update_gm" ON public.import_validation_runs;
CREATE POLICY "ivr_update_gm" ON public.import_validation_runs FOR UPDATE TO authenticated
  USING (public.is_gm_user(auth.uid())) WITH CHECK (public.is_gm_user(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_ivr_obra_sistema ON public.import_validation_runs(obra_id, sistema, created_at DESC);
DROP TRIGGER IF EXISTS trg_ivr_updated_at ON public.import_validation_runs;
CREATE TRIGGER trg_ivr_updated_at BEFORE UPDATE ON public.import_validation_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
