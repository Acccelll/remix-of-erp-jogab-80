-- Backend hardening: stable UUID ownership instead of free-text ownership

ALTER TABLE public.card_anexos
  ADD COLUMN IF NOT EXISTS enviado_por_id uuid;

ALTER TABLE public.card_comentarios
  ADD COLUMN IF NOT EXISTS autor_id uuid;

ALTER TABLE public.solicitacoes_financeiras
  ADD COLUMN IF NOT EXISTS solicitante_user_id uuid;

ALTER TABLE public.solicitacao_comentarios
  ADD COLUMN IF NOT EXISTS autor_id uuid;

-- Backfill from existing profiles where display text matches, then from UUID text columns.
UPDATE public.card_anexos a
SET enviado_por_id = p.id
FROM public.profiles p
WHERE a.enviado_por_id IS NULL
  AND (a.enviado_por = p.login OR a.enviado_por = p.email);

UPDATE public.card_comentarios c
SET autor_id = p.id
FROM public.profiles p
WHERE c.autor_id IS NULL
  AND (c.autor = p.login OR c.autor = p.email);

UPDATE public.solicitacao_comentarios c
SET autor_id = p.id
FROM public.profiles p
WHERE c.autor_id IS NULL
  AND (c.autor = p.login OR c.autor = p.email);

UPDATE public.solicitacoes_financeiras
SET solicitante_user_id = public.safe_uuid(criado_por)
WHERE solicitante_user_id IS NULL
  AND public.safe_uuid(criado_por) IS NOT NULL;

-- Validate obra_atual_id format when present, so RLS cannot depend on malformed text.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'colaboradores_obra_atual_id_uuid_or_null_chk'
      AND conrelid = 'public.colaboradores'::regclass
  ) THEN
    ALTER TABLE public.colaboradores
      ADD CONSTRAINT colaboradores_obra_atual_id_uuid_or_null_chk
      CHECK (obra_atual_id IS NULL OR public.safe_uuid(obra_atual_id) IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

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
  NEW.autor_id := auth.uid();
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
  NEW.enviado_por_id := auth.uid();
  NEW.enviado_por := COALESCE(v_name, auth.uid()::text);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_solicitacao_financeira_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório para solicitação financeira.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.solicitante_user_id := auth.uid();
    NEW.criado_por := auth.uid()::text;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_solicitacao_comentario_author()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado obrigatório para comentar solicitação.';
  END IF;

  v_name := public.current_profile_display_name();
  NEW.autor_id := auth.uid();
  NEW.autor := COALESCE(v_name, auth.uid()::text);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_solicitacao_financeira_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_solicitacao_financeira_author() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_solicitacao_financeira_author() FROM authenticated;
GRANT ALL ON FUNCTION public.enforce_solicitacao_financeira_author() TO service_role;

REVOKE ALL ON FUNCTION public.enforce_solicitacao_comentario_author() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_solicitacao_comentario_author() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_solicitacao_comentario_author() FROM authenticated;
GRANT ALL ON FUNCTION public.enforce_solicitacao_comentario_author() TO service_role;

DROP TRIGGER IF EXISTS trg_enforce_solicitacao_financeira_author ON public.solicitacoes_financeiras;
CREATE TRIGGER trg_enforce_solicitacao_financeira_author
BEFORE INSERT OR UPDATE ON public.solicitacoes_financeiras
FOR EACH ROW
EXECUTE FUNCTION public.enforce_solicitacao_financeira_author();

DROP TRIGGER IF EXISTS trg_enforce_solicitacao_comentario_author ON public.solicitacao_comentarios;
CREATE TRIGGER trg_enforce_solicitacao_comentario_author
BEFORE INSERT OR UPDATE ON public.solicitacao_comentarios
FOR EACH ROW
EXECUTE FUNCTION public.enforce_solicitacao_comentario_author();

-- Tighten card policies with UUID ownership and server-derived display names.
DROP POLICY IF EXISTS "ativ ins" ON public.card_atividades;
CREATE POLICY "ativ ins"
ON public.card_atividades
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_card_setor(card_id)
  AND ator_id = auth.uid()
  AND ator_nome = public.current_profile_display_name()
);

DROP POLICY IF EXISTS "card_comentarios insert" ON public.card_comentarios;
DROP POLICY IF EXISTS "card_comentarios update gm only" ON public.card_comentarios;
DROP POLICY IF EXISTS "card_comentarios delete gm only" ON public.card_comentarios;
CREATE POLICY "card_comentarios insert"
ON public.card_comentarios
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_card_access(card_id)
  AND autor_id = auth.uid()
  AND autor = public.current_profile_display_name()
);
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
DROP POLICY IF EXISTS "card_anexos update gm only" ON public.card_anexos;
DROP POLICY IF EXISTS "card_anexos delete gm or uploader" ON public.card_anexos;
CREATE POLICY "card_anexos insert"
ON public.card_anexos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_card_access(card_id)
  AND enviado_por_id = auth.uid()
  AND enviado_por = public.current_profile_display_name()
);
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
  OR enviado_por_id = auth.uid()
);

-- Tighten financial request/comment policies around stable user UUID.
DROP POLICY IF EXISTS "solfin_select_por_financeiro_gm_ou_autor" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_insert_autor_atual" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_update_financeiro_gm" ON public.solicitacoes_financeiras;

CREATE POLICY "solfin_select_por_financeiro_gm_ou_autor"
ON public.solicitacoes_financeiras
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
  OR solicitante_user_id = auth.uid()
);

CREATE POLICY "solfin_insert_autor_atual"
ON public.solicitacoes_financeiras
FOR INSERT
TO authenticated
WITH CHECK (
  solicitante_user_id = auth.uid()
  AND criado_por = auth.uid()::text
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

DROP POLICY IF EXISTS "solcom_select_por_solicitacao_visivel" ON public.solicitacao_comentarios;
DROP POLICY IF EXISTS "solcom_insert_por_solicitacao_visivel" ON public.solicitacao_comentarios;
DROP POLICY IF EXISTS "solcom_update" ON public.solicitacao_comentarios;
DROP POLICY IF EXISTS "solcom_delete" ON public.solicitacao_comentarios;

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
        OR s.solicitante_user_id = auth.uid()
      )
  )
);

CREATE POLICY "solcom_insert_por_solicitacao_visivel"
ON public.solicitacao_comentarios
FOR INSERT
TO authenticated
WITH CHECK (
  autor_id = auth.uid()
  AND autor = public.current_profile_display_name()
  AND EXISTS (
    SELECT 1
    FROM public.solicitacoes_financeiras s
    WHERE s.id = solicitacao_comentarios.solicitacao_id
      AND (
        public.current_is_gm()
        OR public.current_has_setor('financeiro')
        OR s.solicitante_user_id = auth.uid()
      )
  )
);

CREATE POLICY "solcom_update_gm"
ON public.solicitacao_comentarios
FOR UPDATE
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());

CREATE POLICY "solcom_delete_gm"
ON public.solicitacao_comentarios
FOR DELETE
TO authenticated
USING (public.current_is_gm());

CREATE INDEX IF NOT EXISTS idx_card_anexos_enviado_por_id ON public.card_anexos (enviado_por_id);
CREATE INDEX IF NOT EXISTS idx_card_comentarios_autor_id ON public.card_comentarios (autor_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_financeiras_solicitante_user_id ON public.solicitacoes_financeiras (solicitante_user_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_comentarios_autor_id ON public.solicitacao_comentarios (autor_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_comentarios_solicitacao_id ON public.solicitacao_comentarios (solicitacao_id);