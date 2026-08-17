GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_board_posicao TO authenticated;
GRANT ALL ON public.card_board_posicao TO service_role;
GRANT EXECUTE ON FUNCTION public.card_pode_ver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_pode_editar(uuid) TO authenticated;

DROP POLICY IF EXISTS "cbp_select" ON public.card_board_posicao;
DROP POLICY IF EXISTS "cbp_insert" ON public.card_board_posicao;
DROP POLICY IF EXISTS "cbp_update" ON public.card_board_posicao;
DROP POLICY IF EXISTS "cbp_delete" ON public.card_board_posicao;

CREATE POLICY "cbp_select" ON public.card_board_posicao
  FOR SELECT TO authenticated USING (public.card_pode_ver(card_id));
CREATE POLICY "cbp_insert" ON public.card_board_posicao
  FOR INSERT TO authenticated WITH CHECK (public.card_pode_editar(card_id));
CREATE POLICY "cbp_update" ON public.card_board_posicao
  FOR UPDATE TO authenticated USING (public.card_pode_editar(card_id))
  WITH CHECK (public.card_pode_editar(card_id));
CREATE POLICY "cbp_delete" ON public.card_board_posicao
  FOR DELETE TO authenticated USING (public.card_pode_editar(card_id));