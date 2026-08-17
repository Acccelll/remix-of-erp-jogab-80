DROP POLICY IF EXISTS fat_nfse_write ON public.faturamento_nfse;
CREATE POLICY fat_nfse_write ON public.faturamento_nfse
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'gm')
    OR public.is_current_player_gm() OR public.current_player_has_access('financeiro')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'financeiro') OR public.has_role(auth.uid(), 'gm')
    OR public.is_current_player_gm() OR public.current_player_has_access('financeiro')
  );