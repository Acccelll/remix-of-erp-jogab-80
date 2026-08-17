
-- inspecao_agendas: substitui UPDATE/DELETE totalmente abertos.
DROP POLICY IF EXISTS "Authenticated can update agendas" ON public.inspecao_agendas;
DROP POLICY IF EXISTS "Authenticated can delete agendas" ON public.inspecao_agendas;

CREATE POLICY "inspecao_agendas update gm or owner"
  ON public.inspecao_agendas FOR UPDATE TO authenticated
  USING (public.current_is_gm() OR created_by = auth.uid())
  WITH CHECK (public.current_is_gm() OR created_by = auth.uid());

CREATE POLICY "inspecao_agendas delete gm or owner"
  ON public.inspecao_agendas FOR DELETE TO authenticated
  USING (public.current_is_gm() OR created_by = auth.uid());

-- inspecao_qr_alvos: idem.
DROP POLICY IF EXISTS "Authenticated update qr alvos" ON public.inspecao_qr_alvos;
DROP POLICY IF EXISTS "Authenticated delete qr alvos" ON public.inspecao_qr_alvos;

CREATE POLICY "inspecao_qr_alvos update gm or owner"
  ON public.inspecao_qr_alvos FOR UPDATE TO authenticated
  USING (public.current_is_gm() OR created_by = auth.uid())
  WITH CHECK (public.current_is_gm() OR created_by = auth.uid());

CREATE POLICY "inspecao_qr_alvos delete gm or owner"
  ON public.inspecao_qr_alvos FOR DELETE TO authenticated
  USING (public.current_is_gm() OR created_by = auth.uid());
