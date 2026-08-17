
DROP POLICY IF EXISTS "cards insert" ON public.cards;
CREATE POLICY "cards insert" ON public.cards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "solcom_insert" ON public.solicitacao_comentarios;
CREATE POLICY "solcom_insert" ON public.solicitacao_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "solfin_insert" ON public.solicitacoes_financeiras;
CREATE POLICY "solfin_insert" ON public.solicitacoes_financeiras
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
