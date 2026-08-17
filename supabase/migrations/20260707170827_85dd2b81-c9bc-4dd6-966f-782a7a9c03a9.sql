CREATE TABLE IF NOT EXISTS public.obra_membros (
  user_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('gestor', 'membro', 'observador')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, obra_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_membros TO authenticated;
GRANT ALL ON public.obra_membros TO service_role;

CREATE INDEX IF NOT EXISTS idx_obra_membros_obra ON public.obra_membros(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_membros_user ON public.obra_membros(user_id);

ALTER TABLE public.obra_membros ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_is_gm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'gm'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_empresas()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(ue.empresa_id), '{}'::uuid[])
  FROM public.user_empresas ue
  WHERE ue.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_membros_touch_updated_at ON public.obra_membros;
CREATE TRIGGER trg_obra_membros_touch_updated_at
BEFORE UPDATE ON public.obra_membros
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "obra_membros_auth_select" ON public.obra_membros;
DROP POLICY IF EXISTS "obra_membros_auth_insert" ON public.obra_membros;
DROP POLICY IF EXISTS "obra_membros_auth_update" ON public.obra_membros;
DROP POLICY IF EXISTS "obra_membros_auth_delete" ON public.obra_membros;
DROP POLICY IF EXISTS "obra_membros select" ON public.obra_membros;
DROP POLICY IF EXISTS "obra_membros write gm" ON public.obra_membros;

CREATE POLICY "obra_membros_auth_select"
ON public.obra_membros
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.current_is_gm());

CREATE POLICY "obra_membros_auth_insert"
ON public.obra_membros
FOR INSERT
TO authenticated
WITH CHECK (public.current_is_gm());

CREATE POLICY "obra_membros_auth_update"
ON public.obra_membros
FOR UPDATE
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());

CREATE POLICY "obra_membros_auth_delete"
ON public.obra_membros
FOR DELETE
TO authenticated
USING (public.current_is_gm());