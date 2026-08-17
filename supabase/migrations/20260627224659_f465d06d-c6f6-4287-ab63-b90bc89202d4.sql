
-- Phase 3: tighten RLS on obras/contratos to filter by current_empresas()

-- obras
DROP POLICY IF EXISTS "obras select" ON public.obras;
DROP POLICY IF EXISTS "obras write" ON public.obras;

CREATE POLICY "obras select" ON public.obras
  FOR SELECT TO authenticated
  USING (public.current_is_gm() OR empresa_id = ANY(public.current_empresas()));

CREATE POLICY "obras write" ON public.obras
  FOR ALL TO authenticated
  USING (public.current_is_gm() OR (empresa_id = ANY(public.current_empresas())))
  WITH CHECK (public.current_is_gm() OR (empresa_id = ANY(public.current_empresas())));

-- contratos
DROP POLICY IF EXISTS "contratos read" ON public.contratos;
DROP POLICY IF EXISTS "contratos write" ON public.contratos;

CREATE POLICY "contratos read" ON public.contratos
  FOR SELECT TO authenticated
  USING (public.current_is_gm() OR empresa_id = ANY(public.current_empresas()));

CREATE POLICY "contratos write" ON public.contratos
  FOR ALL TO authenticated
  USING (
    public.current_is_gm()
    OR (
      (public.current_has_setor('Contratos') OR public.current_has_setor('Compras'))
      AND empresa_id = ANY(public.current_empresas())
    )
  )
  WITH CHECK (
    public.current_is_gm()
    OR (
      (public.current_has_setor('Contratos') OR public.current_has_setor('Compras'))
      AND empresa_id = ANY(public.current_empresas())
    )
  );
