CREATE OR REPLACE FUNCTION public.user_pode_editar_obra(p_obra uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = p_obra
        AND om.papel IN ('gestor', 'membro')
    )
    OR EXISTS (
      SELECT 1
      FROM public.obras o
      WHERE o.id = p_obra
        AND o.empresa_id = ANY(public.current_empresas())
    );
$$;

REVOKE ALL ON FUNCTION public.user_pode_editar_obra(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_pode_editar_obra(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.user_pode_editar_obra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_pode_editar_obra(uuid) TO service_role;

-- Compras
DROP POLICY IF EXISTS "ordens_compra read" ON public.ordens_compra;
DROP POLICY IF EXISTS "ordens_compra write" ON public.ordens_compra;

CREATE POLICY "ordens_compra read por obra"
ON public.ordens_compra
FOR SELECT
TO authenticated
USING (public.user_em_obra(obra_id));

CREATE POLICY "ordens_compra write compras por obra"
ON public.ordens_compra
FOR ALL
TO authenticated
USING (
  public.user_pode_editar_obra(obra_id)
  AND (public.current_is_gm() OR public.current_has_setor('Compras'))
)
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND (public.current_is_gm() OR public.current_has_setor('Compras'))
);

-- Medições
DROP POLICY IF EXISTS "med_select" ON public.medicoes;
DROP POLICY IF EXISTS "med_write" ON public.medicoes;

CREATE POLICY "medicoes read por obra"
ON public.medicoes
FOR SELECT
TO authenticated
USING (public.user_em_obra(obra_id));

CREATE POLICY "medicoes write financeiro por obra"
ON public.medicoes
FOR ALL
TO authenticated
USING (
  public.user_pode_editar_obra(obra_id)
  AND (public.current_is_gm() OR public.current_has_setor('financeiro') OR public.current_has_setor('Financeiro'))
)
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND (public.current_is_gm() OR public.current_has_setor('financeiro') OR public.current_has_setor('Financeiro'))
);

-- Contratos
DROP POLICY IF EXISTS "contratos read" ON public.contratos;
DROP POLICY IF EXISTS "contratos write" ON public.contratos;

CREATE POLICY "contratos read por obra"
ON public.contratos
FOR SELECT
TO authenticated
USING (public.user_em_obra(obra_id));

CREATE POLICY "contratos write contratos compras por obra"
ON public.contratos
FOR ALL
TO authenticated
USING (
  public.user_pode_editar_obra(obra_id)
  AND (
    public.current_is_gm()
    OR public.current_has_setor('Contratos')
    OR public.current_has_setor('Compras')
  )
)
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND (
    public.current_is_gm()
    OR public.current_has_setor('Contratos')
    OR public.current_has_setor('Compras')
  )
);

-- Orçamento
DROP POLICY IF EXISTS "orc read" ON public.orcamento_itens;
DROP POLICY IF EXISTS "orc write" ON public.orcamento_itens;

CREATE POLICY "orcamento_itens read por obra"
ON public.orcamento_itens
FOR SELECT
TO authenticated
USING (public.user_em_obra(obra_id));

CREATE POLICY "orcamento_itens write engenharia por obra"
ON public.orcamento_itens
FOR ALL
TO authenticated
USING (
  public.user_pode_editar_obra(obra_id)
  AND (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()))
)
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND (public.current_is_gm() OR 'Engenharia' = ANY(public.current_setores()))
);

-- Inspeções
DROP POLICY IF EXISTS "inspecoes deletar gm" ON public.inspecoes;
DROP POLICY IF EXISTS "inspecoes editar autor/responsavel/gm" ON public.inspecoes;
DROP POLICY IF EXISTS "inspecoes inserir autenticado" ON public.inspecoes;
DROP POLICY IF EXISTS "inspecoes visiveis para setores e autor" ON public.inspecoes;

CREATE POLICY "inspecoes read por obra e qualidade"
ON public.inspecoes
FOR SELECT
TO authenticated
USING (
  public.user_em_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
    OR responsavel_id = auth.uid()
    OR 'Qualidade' = ANY(public.current_setores())
    OR 'Engenharia' = ANY(public.current_setores())
    OR 'Segurança' = ANY(public.current_setores())
  )
);

CREATE POLICY "inspecoes insert por obra"
ON public.inspecoes
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND created_by = auth.uid()
);

CREATE POLICY "inspecoes update por obra"
ON public.inspecoes
FOR UPDATE
TO authenticated
USING (
  public.user_pode_editar_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
    OR responsavel_id = auth.uid()
  )
)
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
    OR responsavel_id = auth.uid()
  )
);

CREATE POLICY "inspecoes delete gm"
ON public.inspecoes
FOR DELETE
TO authenticated
USING (public.current_is_gm());

-- Não conformidades
DROP POLICY IF EXISTS "nc deletar gm" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc editar gm/qualidade/eng/seg/quem" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc inserir autenticado" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc visiveis para setores e responsavel" ON public.nao_conformidades;

CREATE POLICY "nc read por obra e qualidade"
ON public.nao_conformidades
FOR SELECT
TO authenticated
USING (
  public.user_em_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
    OR quem = auth.uid()
    OR 'Qualidade' = ANY(public.current_setores())
    OR 'Engenharia' = ANY(public.current_setores())
    OR 'Segurança' = ANY(public.current_setores())
  )
);

CREATE POLICY "nc insert por obra"
ON public.nao_conformidades
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND created_by = auth.uid()
);

CREATE POLICY "nc update por obra"
ON public.nao_conformidades
FOR UPDATE
TO authenticated
USING (
  public.user_pode_editar_obra(obra_id)
  AND (
    public.current_is_gm()
    OR quem = auth.uid()
    OR created_by = auth.uid()
    OR 'Qualidade' = ANY(public.current_setores())
    OR 'Engenharia' = ANY(public.current_setores())
    OR 'Segurança' = ANY(public.current_setores())
  )
)
WITH CHECK (
  public.user_pode_editar_obra(obra_id)
  AND (
    public.current_is_gm()
    OR quem = auth.uid()
    OR created_by = auth.uid()
    OR 'Qualidade' = ANY(public.current_setores())
    OR 'Engenharia' = ANY(public.current_setores())
    OR 'Segurança' = ANY(public.current_setores())
  )
);

CREATE POLICY "nc delete gm"
ON public.nao_conformidades
FOR DELETE
TO authenticated
USING (public.current_is_gm());