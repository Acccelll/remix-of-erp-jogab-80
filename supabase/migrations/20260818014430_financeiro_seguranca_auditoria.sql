-- ETAPA 4 — Segurança e auditoria do núcleo financeiro canônico.
-- Fecha autorização de escrita, trilha imutável de eventos e imutabilidade do ledger.

CREATE OR REPLACE FUNCTION private.financeiro_pode_operar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       public.has_role(auth.uid(), 'gm'::public.app_role)
       OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
       OR EXISTS (
         SELECT 1
         FROM public.profiles pr
         JOIN public.players pl ON lower(btrim(pl.login)) = lower(btrim(pr.login))
         WHERE pr.id = auth.uid()
           AND (
             pl.is_gm = true
             OR COALESCE(pl.acessos ->> 'financeiro', 'nenhum') = 'editar'
           )
       )
     );
$$;

REVOKE ALL ON FUNCTION private.financeiro_pode_operar() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.fn_financeiro_guard_dml()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT private.financeiro_pode_operar() THEN
      RAISE EXCEPTION 'Sem permissão operacional no Financeiro';
    END IF;
  ELSIF COALESCE(v_claim_role, '') NOT IN ('', 'service_role') THEN
    RAISE EXCEPTION 'Operação financeira exige usuário autenticado com permissão adequada';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_financeiro_guard_dml() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_fin_guard_titulos ON public.financeiro_titulos;
CREATE TRIGGER trg_fin_guard_titulos
BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_titulos
FOR EACH ROW EXECUTE FUNCTION private.fn_financeiro_guard_dml();

DROP TRIGGER IF EXISTS trg_fin_guard_rateios ON public.financeiro_titulo_rateios;
CREATE TRIGGER trg_fin_guard_rateios
BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_titulo_rateios
FOR EACH ROW EXECUTE FUNCTION private.fn_financeiro_guard_dml();

DROP TRIGGER IF EXISTS trg_fin_guard_baixas ON public.financeiro_titulo_baixas;
CREATE TRIGGER trg_fin_guard_baixas
BEFORE INSERT ON public.financeiro_titulo_baixas
FOR EACH ROW EXECUTE FUNCTION private.fn_financeiro_guard_dml();

CREATE TABLE public.financeiro_titulo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES public.financeiro_titulos(id) ON DELETE RESTRICT,
  baixa_id uuid NULL REFERENCES public.financeiro_titulo_baixas(id) ON DELETE RESTRICT,
  entidade text NOT NULL,
  entidade_id uuid NOT NULL,
  evento text NOT NULL,
  ator_id uuid NULL,
  ator_login text NULL,
  origem text NOT NULL DEFAULT 'app',
  dados_antes jsonb NULL,
  dados_depois jsonb NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_titulo_eventos_entidade_ck
    CHECK (entidade IN ('titulo', 'rateio', 'baixa')),
  CONSTRAINT financeiro_titulo_eventos_evento_ck
    CHECK (length(btrim(evento)) > 0),
  CONSTRAINT financeiro_titulo_eventos_origem_ck
    CHECK (length(btrim(origem)) > 0)
);

COMMENT ON TABLE public.financeiro_titulo_eventos IS
  'Trilha append-only das alterações do título financeiro canônico. Não representa estado; registra fatos auditáveis.';
COMMENT ON COLUMN public.financeiro_titulo_eventos.ator_login IS
  'Snapshot do login no momento do evento para preservar legibilidade histórica mesmo se o perfil mudar.';

CREATE INDEX idx_fin_titulo_eventos_titulo_data
  ON public.financeiro_titulo_eventos (titulo_id, criado_em DESC);
CREATE INDEX idx_fin_titulo_eventos_entidade
  ON public.financeiro_titulo_eventos (entidade, entidade_id, criado_em DESC);
CREATE INDEX idx_fin_titulo_eventos_ator
  ON public.financeiro_titulo_eventos (ator_id, criado_em DESC)
  WHERE ator_id IS NOT NULL;

ALTER TABLE public.financeiro_titulo_eventos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_titulo_eventos FROM anon;
REVOKE ALL ON public.financeiro_titulo_eventos FROM authenticated;
REVOKE ALL ON public.financeiro_titulo_eventos FROM service_role;
GRANT SELECT ON public.financeiro_titulo_eventos TO authenticated;
GRANT SELECT, INSERT ON public.financeiro_titulo_eventos TO service_role;

CREATE POLICY financeiro_titulo_eventos_select
ON public.financeiro_titulo_eventos
FOR SELECT TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE OR REPLACE FUNCTION private.fn_financeiro_eventos_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Eventos financeiros são imutáveis';
END;
$$;
REVOKE ALL ON FUNCTION private.fn_financeiro_eventos_immutable() FROM PUBLIC;

CREATE TRIGGER trg_fin_eventos_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_titulo_eventos
FOR EACH ROW EXECUTE FUNCTION private.fn_financeiro_eventos_immutable();

CREATE OR REPLACE FUNCTION private.fn_financeiro_baixas_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Baixas financeiras são imutáveis; utilize estorno em vez de alterar ou excluir o movimento';
END;
$$;
REVOKE ALL ON FUNCTION private.fn_financeiro_baixas_immutable() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_fin_baixas_immutable ON public.financeiro_titulo_baixas;
CREATE TRIGGER trg_fin_baixas_immutable
BEFORE UPDATE OR DELETE ON public.financeiro_titulo_baixas
FOR EACH ROW EXECUTE FUNCTION private.fn_financeiro_baixas_immutable();

REVOKE UPDATE, DELETE, TRUNCATE ON public.financeiro_titulo_baixas FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.financeiro_titulo_baixas FROM service_role;

CREATE OR REPLACE FUNCTION private.fn_auditar_financeiro_canonico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo_id uuid;
  v_baixa_id uuid;
  v_entidade text;
  v_entidade_id uuid;
  v_evento text;
  v_ator_id uuid := auth.uid();
  v_ator_login text;
  v_origem text;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  IF v_ator_id IS NOT NULL THEN
    SELECT pr.login INTO v_ator_login
    FROM public.profiles pr
    WHERE pr.id = v_ator_id;
  END IF;

  v_origem := CASE WHEN v_ator_id IS NULL THEN 'sistema' ELSE 'app' END;

  IF TG_TABLE_NAME = 'financeiro_titulos' THEN
    v_titulo_id := COALESCE(NEW.id, OLD.id);
    v_entidade := 'titulo';
    v_entidade_id := v_titulo_id;
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_depois := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

    IF TG_OP = 'INSERT' THEN
      v_evento := 'titulo_criado';
    ELSIF TG_OP = 'DELETE' THEN
      v_evento := 'titulo_excluido';
    ELSIF OLD.status IS DISTINCT FROM NEW.status
       AND (to_jsonb(OLD) - 'status' - 'atualizado_em' - 'atualizado_por')
         = (to_jsonb(NEW) - 'status' - 'atualizado_em' - 'atualizado_por') THEN
      v_evento := 'status_alterado';
    ELSIF (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por')
          = (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por') THEN
      RETURN NEW;
    ELSE
      v_evento := 'titulo_alterado';
    END IF;

  ELSIF TG_TABLE_NAME = 'financeiro_titulo_rateios' THEN
    v_titulo_id := COALESCE(NEW.titulo_id, OLD.titulo_id);
    v_entidade := 'rateio';
    v_entidade_id := COALESCE(NEW.id, OLD.id);
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_depois := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_evento := CASE TG_OP
      WHEN 'INSERT' THEN 'rateio_criado'
      WHEN 'UPDATE' THEN 'rateio_alterado'
      ELSE 'rateio_removido'
    END;

  ELSIF TG_TABLE_NAME = 'financeiro_titulo_baixas' THEN
    v_titulo_id := NEW.titulo_id;
    v_baixa_id := NEW.id;
    v_entidade := 'baixa';
    v_entidade_id := NEW.id;
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
    v_evento := 'baixa_registrada';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.financeiro_titulo_eventos (
    titulo_id, baixa_id, entidade, entidade_id, evento,
    ator_id, ator_login, origem, dados_antes, dados_depois,
    metadata
  ) VALUES (
    v_titulo_id, v_baixa_id, v_entidade, v_entidade_id, v_evento,
    v_ator_id, v_ator_login, v_origem, v_antes, v_depois,
    jsonb_build_object('operacao_sql', TG_OP, 'tabela', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_auditar_financeiro_canonico() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_fin_audit_titulos ON public.financeiro_titulos;
CREATE TRIGGER trg_fin_audit_titulos
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_titulos
FOR EACH ROW EXECUTE FUNCTION private.fn_auditar_financeiro_canonico();

DROP TRIGGER IF EXISTS trg_fin_audit_rateios ON public.financeiro_titulo_rateios;
CREATE TRIGGER trg_fin_audit_rateios
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_titulo_rateios
FOR EACH ROW EXECUTE FUNCTION private.fn_auditar_financeiro_canonico();

DROP TRIGGER IF EXISTS trg_fin_audit_baixas ON public.financeiro_titulo_baixas;
CREATE TRIGGER trg_fin_audit_baixas
AFTER INSERT ON public.financeiro_titulo_baixas
FOR EACH ROW EXECUTE FUNCTION private.fn_auditar_financeiro_canonico();
