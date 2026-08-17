
-- card_custom_field_valores
DROP POLICY IF EXISTS ccfv_all ON public.card_custom_field_valores;
CREATE POLICY ccfv_select ON public.card_custom_field_valores
  FOR SELECT TO authenticated USING (public.has_card_access(card_id));
CREATE POLICY ccfv_insert ON public.card_custom_field_valores
  FOR INSERT TO authenticated WITH CHECK (public.has_card_access(card_id));
CREATE POLICY ccfv_update ON public.card_custom_field_valores
  FOR UPDATE TO authenticated USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY ccfv_delete ON public.card_custom_field_valores
  FOR DELETE TO authenticated USING (public.has_card_access(card_id));

-- card_membros_externos
DROP POLICY IF EXISTS card_membros_externos_all ON public.card_membros_externos;
CREATE POLICY cme_select ON public.card_membros_externos
  FOR SELECT TO authenticated USING (public.has_card_access(card_id));
CREATE POLICY cme_insert ON public.card_membros_externos
  FOR INSERT TO authenticated WITH CHECK (public.has_card_access(card_id));
CREATE POLICY cme_update ON public.card_membros_externos
  FOR UPDATE TO authenticated USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY cme_delete ON public.card_membros_externos
  FOR DELETE TO authenticated USING (public.has_card_access(card_id));

-- card_campos_valores
DROP POLICY IF EXISTS card_campos_valores_all ON public.card_campos_valores;
CREATE POLICY ccv_select ON public.card_campos_valores
  FOR SELECT TO authenticated USING (public.has_card_access(card_id));
CREATE POLICY ccv_insert ON public.card_campos_valores
  FOR INSERT TO authenticated WITH CHECK (public.has_card_access(card_id));
CREATE POLICY ccv_update ON public.card_campos_valores
  FOR UPDATE TO authenticated USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY ccv_delete ON public.card_campos_valores
  FOR DELETE TO authenticated USING (public.has_card_access(card_id));

-- card_custom_fields: registro global de tipos de campo (sem card_id)
DROP POLICY IF EXISTS ccf_all ON public.card_custom_fields;
CREATE POLICY ccf_select ON public.card_custom_fields
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ccf_write ON public.card_custom_fields
  FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());

-- Garantir grants (evita erro do PostgREST)
REVOKE ALL ON public.card_custom_field_valores FROM anon;
REVOKE ALL ON public.card_membros_externos FROM anon;
REVOKE ALL ON public.card_campos_valores FROM anon;
REVOKE ALL ON public.card_custom_fields FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_custom_field_valores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros_externos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_campos_valores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_custom_fields TO authenticated;
