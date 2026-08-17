-- Backend hardening: authorship integrity and remaining broad policies

CREATE OR REPLACE FUNCTION public.current_profile_display_name()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(p.login, ''),
    NULLIF(p.email, ''),
    auth.uid()::text
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_profile_display_name() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_profile_display_name() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_profile_display_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_display_name() TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_card_activity_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório para registrar atividade.';
  END IF;

  v_name := public.current_profile_display_name();
  NEW.ator_id := auth.uid();
  NEW.ator_nome := COALESCE(v_name, auth.uid()::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_card_comment_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório para comentar.';
  END IF;

  v_name := public.current_profile_display_name();
  NEW.autor := COALESCE(v_name, auth.uid()::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_card_attachment_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório para anexar arquivo.';
  END IF;

  v_name := public.current_profile_display_name();
  NEW.enviado_por := COALESCE(v_name, auth.uid()::text);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_card_activity_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_card_activity_author() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_card_activity_author() FROM authenticated;
GRANT ALL ON FUNCTION public.enforce_card_activity_author() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_card_comment_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_card_comment_author() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_card_comment_author() FROM authenticated;
GRANT ALL ON FUNCTION public.enforce_card_comment_author() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_card_attachment_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_card_attachment_author() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_card_attachment_author() FROM authenticated;
GRANT ALL ON FUNCTION public.enforce_card_attachment_author() TO service_role;

DROP TRIGGER IF EXISTS trg_enforce_card_activity_author ON public.card_atividades;
CREATE TRIGGER trg_enforce_card_activity_author
BEFORE INSERT OR UPDATE ON public.card_atividades
FOR EACH ROW
EXECUTE FUNCTION public.enforce_card_activity_author();

DROP TRIGGER IF EXISTS trg_enforce_card_comment_author ON public.card_comentarios;
CREATE TRIGGER trg_enforce_card_comment_author
BEFORE INSERT OR UPDATE ON public.card_comentarios
FOR EACH ROW
EXECUTE FUNCTION public.enforce_card_comment_author();

DROP TRIGGER IF EXISTS trg_enforce_card_attachment_author ON public.card_anexos;
CREATE TRIGGER trg_enforce_card_attachment_author
BEFORE INSERT OR UPDATE ON public.card_anexos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_card_attachment_author();

DROP POLICY IF EXISTS "ativ ins" ON public.card_atividades;
CREATE POLICY "ativ ins"
ON public.card_atividades
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_card_setor(card_id)
  AND (ator_id IS NULL OR ator_id = auth.uid())
);

DROP POLICY IF EXISTS "card_comentarios insert" ON public.card_comentarios;
DROP POLICY IF EXISTS "card_comentarios update" ON public.card_comentarios;
DROP POLICY IF EXISTS "card_comentarios delete" ON public.card_comentarios;
CREATE POLICY "card_comentarios insert"
ON public.card_comentarios
FOR INSERT
TO authenticated
WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_comentarios update gm only"
ON public.card_comentarios
FOR UPDATE
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());
CREATE POLICY "card_comentarios delete gm only"
ON public.card_comentarios
FOR DELETE
TO authenticated
USING (public.current_is_gm());

DROP POLICY IF EXISTS "card_anexos insert" ON public.card_anexos;
DROP POLICY IF EXISTS "card_anexos update" ON public.card_anexos;
DROP POLICY IF EXISTS "card_anexos delete" ON public.card_anexos;
CREATE POLICY "card_anexos insert"
ON public.card_anexos
FOR INSERT
TO authenticated
WITH CHECK (public.has_card_access(card_id));
CREATE POLICY "card_anexos update gm only"
ON public.card_anexos
FOR UPDATE
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());
CREATE POLICY "card_anexos delete gm or uploader"
ON public.card_anexos
FOR DELETE
TO authenticated
USING (
  public.current_is_gm()
  OR enviado_por = public.current_profile_display_name()
);

-- Inspection agendas: scope reads/writes to obra access and responsible sectors.
DROP POLICY IF EXISTS "Authenticated can read agendas" ON public.inspecao_agendas;
DROP POLICY IF EXISTS "Authenticated can write agendas" ON public.inspecao_agendas;
DROP POLICY IF EXISTS "inspecao_agendas update gm or owner" ON public.inspecao_agendas;
DROP POLICY IF EXISTS "inspecao_agendas delete gm or owner" ON public.inspecao_agendas;

CREATE POLICY "inspecao_agendas read obra"
ON public.inspecao_agendas
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

CREATE POLICY "inspecao_agendas insert obra"
ON public.inspecao_agendas
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_em_obra(obra_id)
  AND created_by = auth.uid()
  AND (
    public.current_is_gm()
    OR 'Qualidade' = ANY(public.current_setores())
    OR 'Engenharia' = ANY(public.current_setores())
    OR 'Segurança' = ANY(public.current_setores())
  )
);

CREATE POLICY "inspecao_agendas update gm or owner obra"
ON public.inspecao_agendas
FOR UPDATE
TO authenticated
USING (
  public.user_em_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
    OR responsavel_id = auth.uid()
  )
)
WITH CHECK (
  public.user_em_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
    OR responsavel_id = auth.uid()
  )
);

CREATE POLICY "inspecao_agendas delete gm or owner obra"
ON public.inspecao_agendas
FOR DELETE
TO authenticated
USING (
  public.user_em_obra(obra_id)
  AND (
    public.current_is_gm()
    OR created_by = auth.uid()
  )
);

-- Financial requests: no visibility through mutable free-text solicitante.
DROP POLICY IF EXISTS "solfin_select_por_financeiro_gm_ou_autor" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_insert_autor_atual" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_update" ON public.solicitacoes_financeiras;

CREATE POLICY "solfin_select_por_financeiro_gm_ou_autor"
ON public.solicitacoes_financeiras
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
  OR criado_por = auth.uid()::text
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

CREATE POLICY "solfin_update_financeiro_gm"
ON public.solicitacoes_financeiras
FOR UPDATE
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
)
WITH CHECK (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
);

CREATE INDEX IF NOT EXISTS idx_inspecao_agendas_obra_id ON public.inspecao_agendas (obra_id);
CREATE INDEX IF NOT EXISTS idx_inspecao_agendas_created_by ON public.inspecao_agendas (created_by);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_financeiras_criado_por ON public.solicitacoes_financeiras (criado_por);
CREATE INDEX IF NOT EXISTS idx_card_anexos_enviado_por ON public.card_anexos (enviado_por);