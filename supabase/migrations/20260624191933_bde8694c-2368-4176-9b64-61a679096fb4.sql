
CREATE OR REPLACE FUNCTION public.has_card_access(p_card_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_is_gm() OR EXISTS (
    SELECT 1 FROM public.card_setores cs
    WHERE cs.card_id = p_card_id
      AND cs.setor = ANY(public.current_setores())
  );
$$;

-- cards
DROP POLICY IF EXISTS "cards acesso" ON public.cards;
REVOKE ALL ON public.cards FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
CREATE POLICY "cards select" ON public.cards FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.has_card_access(id));
CREATE POLICY "cards insert" ON public.cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cards update" ON public.cards FOR UPDATE TO authenticated
USING (public.current_is_gm() OR public.has_card_access(id))
WITH CHECK (public.current_is_gm() OR public.has_card_access(id));
CREATE POLICY "cards delete" ON public.cards FOR DELETE TO authenticated
USING (public.current_is_gm() OR public.has_card_access(id));

-- card_setores
DROP POLICY IF EXISTS "card_setores acesso" ON public.card_setores;
REVOKE ALL ON public.card_setores FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_setores TO authenticated;
GRANT ALL ON public.card_setores TO service_role;
CREATE POLICY "card_setores select" ON public.card_setores FOR SELECT TO authenticated
USING (public.current_is_gm() OR setor = ANY(public.current_setores()) OR public.has_card_access(card_id));
CREATE POLICY "card_setores write" ON public.card_setores FOR ALL TO authenticated
USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());

-- card_recursos
DROP POLICY IF EXISTS "card_recursos acesso" ON public.card_recursos;
REVOKE ALL ON public.card_recursos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_recursos TO authenticated;
GRANT ALL ON public.card_recursos TO service_role;
CREATE POLICY "card_recursos select" ON public.card_recursos FOR SELECT TO authenticated
USING (public.has_card_access(card_id));
CREATE POLICY "card_recursos insert" ON public.card_recursos FOR INSERT TO authenticated
WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_recursos update" ON public.card_recursos FOR UPDATE TO authenticated
USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_recursos delete" ON public.card_recursos FOR DELETE TO authenticated
USING (public.has_card_access(card_id));

-- card_comentarios
DROP POLICY IF EXISTS "card_comentarios acesso" ON public.card_comentarios;
REVOKE ALL ON public.card_comentarios FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_comentarios TO authenticated;
GRANT ALL ON public.card_comentarios TO service_role;
CREATE POLICY "card_comentarios select" ON public.card_comentarios FOR SELECT TO authenticated
USING (public.has_card_access(card_id));
CREATE POLICY "card_comentarios insert" ON public.card_comentarios FOR INSERT TO authenticated
WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_comentarios update" ON public.card_comentarios FOR UPDATE TO authenticated
USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_comentarios delete" ON public.card_comentarios FOR DELETE TO authenticated
USING (public.has_card_access(card_id));

-- card_anexos
DROP POLICY IF EXISTS "card_anexos acesso" ON public.card_anexos;
REVOKE ALL ON public.card_anexos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_anexos TO authenticated;
GRANT ALL ON public.card_anexos TO service_role;
CREATE POLICY "card_anexos select" ON public.card_anexos FOR SELECT TO authenticated
USING (public.has_card_access(card_id));
CREATE POLICY "card_anexos insert" ON public.card_anexos FOR INSERT TO authenticated
WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_anexos update" ON public.card_anexos FOR UPDATE TO authenticated
USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_anexos delete" ON public.card_anexos FOR DELETE TO authenticated
USING (public.has_card_access(card_id));

-- card_checklist_itens
DROP POLICY IF EXISTS "card_checklist_itens acesso" ON public.card_checklist_itens;
REVOKE ALL ON public.card_checklist_itens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_checklist_itens TO authenticated;
GRANT ALL ON public.card_checklist_itens TO service_role;
CREATE POLICY "card_checklist_itens select" ON public.card_checklist_itens FOR SELECT TO authenticated
USING (public.has_card_access(card_id));
CREATE POLICY "card_checklist_itens insert" ON public.card_checklist_itens FOR INSERT TO authenticated
WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_checklist_itens update" ON public.card_checklist_itens FOR UPDATE TO authenticated
USING (public.has_card_access(card_id)) WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_checklist_itens delete" ON public.card_checklist_itens FOR DELETE TO authenticated
USING (public.has_card_access(card_id));

-- card_grupos_negociacao (tabela global de rótulos — sem card_id)
DROP POLICY IF EXISTS "card_grupos_negociacao acesso" ON public.card_grupos_negociacao;
REVOKE ALL ON public.card_grupos_negociacao FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_grupos_negociacao TO authenticated;
GRANT ALL ON public.card_grupos_negociacao TO service_role;
CREATE POLICY "card_grupos_negociacao select" ON public.card_grupos_negociacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "card_grupos_negociacao write" ON public.card_grupos_negociacao FOR ALL TO authenticated
USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());

-- lead_time_templates
DROP POLICY IF EXISTS "lead_time_templates acesso" ON public.lead_time_templates;
REVOKE ALL ON public.lead_time_templates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_time_templates TO authenticated;
GRANT ALL ON public.lead_time_templates TO service_role;
CREATE POLICY "lead_time_templates select" ON public.lead_time_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_time_templates write" ON public.lead_time_templates FOR ALL TO authenticated
USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());
