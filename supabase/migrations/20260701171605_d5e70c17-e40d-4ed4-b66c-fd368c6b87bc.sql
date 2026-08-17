DROP POLICY IF EXISTS "solfin_select" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_insert" ON public.solicitacoes_financeiras;

CREATE POLICY "solfin_select_por_financeiro_gm_ou_autor"
ON public.solicitacoes_financeiras
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
  OR criado_por = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        solicitacoes_financeiras.solicitante = p.login
        OR solicitacoes_financeiras.solicitante = p.email
      )
  )
);

CREATE POLICY "solfin_insert_autor_atual"
ON public.solicitacoes_financeiras
FOR INSERT
TO authenticated
WITH CHECK (
  criado_por = auth.uid()::text
  OR public.current_is_gm()
  OR public.current_has_setor('financeiro')
);

DROP POLICY IF EXISTS "solcom_select" ON public.solicitacao_comentarios;
DROP POLICY IF EXISTS "solcom_insert" ON public.solicitacao_comentarios;

CREATE POLICY "solcom_select_por_solicitacao_visivel"
ON public.solicitacao_comentarios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_financeiras s
    WHERE s.id = solicitacao_comentarios.solicitacao_id
      AND (
        public.current_is_gm()
        OR public.current_has_setor('financeiro')
        OR s.criado_por = auth.uid()::text
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (s.solicitante = p.login OR s.solicitante = p.email)
        )
      )
  )
);

CREATE POLICY "solcom_insert_por_solicitacao_visivel"
ON public.solicitacao_comentarios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.solicitacoes_financeiras s
    WHERE s.id = solicitacao_comentarios.solicitacao_id
      AND (
        public.current_is_gm()
        OR public.current_has_setor('financeiro')
        OR s.criado_por = auth.uid()::text
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (s.solicitante = p.login OR s.solicitante = p.email)
        )
      )
  )
);

DROP POLICY IF EXISTS "controle_despesas read all" ON public.controle_despesas;

CREATE POLICY "controle_despesas read financeiro ou gm"
ON public.controle_despesas
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
);