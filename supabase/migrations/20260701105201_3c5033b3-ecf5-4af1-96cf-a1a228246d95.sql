CREATE TABLE IF NOT EXISTS public.obra_membros (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'membro' CHECK (papel IN ('gestor', 'membro', 'observador')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, obra_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_membros_obra ON public.obra_membros(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_membros_user ON public.obra_membros(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_membros TO authenticated;
GRANT ALL ON public.obra_membros TO service_role;

ALTER TABLE public.obra_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_membros select" ON public.obra_membros;
DROP POLICY IF EXISTS "obra_membros write gm" ON public.obra_membros;

CREATE POLICY "obra_membros select"
  ON public.obra_membros FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_is_gm());

CREATE POLICY "obra_membros write gm"
  ON public.obra_membros FOR ALL TO authenticated
  USING (public.current_is_gm())
  WITH CHECK (public.current_is_gm());

CREATE OR REPLACE FUNCTION public.current_obras()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_is_gm() THEN
      COALESCE((SELECT array_agg(id) FROM public.obras), '{}'::uuid[])
    ELSE
      COALESCE(
        (
          SELECT array_agg(DISTINCT obra_id)
          FROM (
            SELECT om.obra_id
            FROM public.obra_membros om
            WHERE om.user_id = auth.uid()
            UNION
            SELECT o.id AS obra_id
            FROM public.obras o
            WHERE o.empresa_id = ANY(public.current_empresas())
          ) s
        ),
        '{}'::uuid[]
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_em_obra(p_obra uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = p_obra
    )
    OR EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id = p_obra
        AND o.empresa_id = ANY(public.current_empresas())
    );
$$;

INSERT INTO public.obra_membros (user_id, obra_id, papel)
SELECT DISTINCT ue.user_id, o.id, CASE WHEN ue.papel = 'gestor' THEN 'gestor' ELSE 'membro' END
FROM public.user_empresas ue
JOIN public.obras o ON o.empresa_id = ue.empresa_id
ON CONFLICT (user_id, obra_id) DO NOTHING;

INSERT INTO public.obra_membros (user_id, obra_id, papel)
SELECT DISTINCT p.id, o.id, 'gestor'
FROM public.profiles p
CROSS JOIN public.obras o
WHERE COALESCE(p.is_gm, false)
ON CONFLICT (user_id, obra_id) DO NOTHING;

DROP POLICY IF EXISTS "obras select" ON public.obras;
DROP POLICY IF EXISTS "obras write" ON public.obras;

CREATE POLICY "obras select"
  ON public.obras FOR SELECT TO authenticated
  USING (public.current_is_gm() OR public.user_em_obra(id) OR empresa_id = ANY(public.current_empresas()));

CREATE POLICY "obras write"
  ON public.obras FOR ALL TO authenticated
  USING (public.current_is_gm() OR empresa_id = ANY(public.current_empresas()))
  WITH CHECK (public.current_is_gm() OR empresa_id = ANY(public.current_empresas()));