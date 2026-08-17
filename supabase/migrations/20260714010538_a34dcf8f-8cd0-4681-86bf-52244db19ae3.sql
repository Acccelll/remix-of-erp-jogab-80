CREATE OR REPLACE FUNCTION public.user_em_obra(p_obra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = p_obra_id
    )
$$;

REVOKE ALL ON FUNCTION public.user_em_obra(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_em_obra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_em_obra(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.rdo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data date NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  clima_manha text,
  clima_tarde text,
  clima_noite text,
  trabalhavel_manha boolean,
  trabalhavel_tarde boolean,
  trabalhavel_noite boolean,
  observacoes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho',
  numero_documental text,
  fechado_em timestamptz,
  fechado_por text,
  assinado_em timestamptz,
  assinado_por text,
  assinatura_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz,
  UNIQUE (obra_id, data),
  CONSTRAINT rdo_assinatura_sha256_format CHECK (assinatura_sha256 IS NULL OR assinatura_sha256 ~ '^sha256:[a-f0-9]{64}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo TO authenticated;
GRANT ALL ON public.rdo TO service_role;
ALTER TABLE public.rdo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo read" ON public.rdo;
DROP POLICY IF EXISTS "rdo write" ON public.rdo;
CREATE POLICY "rdo read" ON public.rdo FOR SELECT TO authenticated USING (public.user_em_obra(obra_id));
CREATE POLICY "rdo write" ON public.rdo FOR ALL TO authenticated USING (public.user_em_obra(obra_id)) WITH CHECK (public.user_em_obra(obra_id));

CREATE TABLE IF NOT EXISTS public.rdo_efetivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.funcoes(id) ON DELETE SET NULL,
  quantidade integer NOT NULL DEFAULT 1,
  presente boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_efetivo TO authenticated;
GRANT ALL ON public.rdo_efetivo TO service_role;
ALTER TABLE public.rdo_efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo_efetivo read" ON public.rdo_efetivo;
DROP POLICY IF EXISTS "rdo_efetivo write" ON public.rdo_efetivo;
CREATE POLICY "rdo_efetivo read" ON public.rdo_efetivo FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_efetivo.rdo_id AND public.user_em_obra(r.obra_id)));
CREATE POLICY "rdo_efetivo write" ON public.rdo_efetivo FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_efetivo.rdo_id AND public.user_em_obra(r.obra_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_efetivo.rdo_id AND public.user_em_obra(r.obra_id)));

CREATE TABLE IF NOT EXISTS public.rdo_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo(id) ON DELETE CASCADE,
  cronograma_item_id uuid REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT '',
  quantidade numeric(14,4),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_atividades TO authenticated;
GRANT ALL ON public.rdo_atividades TO service_role;
ALTER TABLE public.rdo_atividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo_atividades read" ON public.rdo_atividades;
DROP POLICY IF EXISTS "rdo_atividades write" ON public.rdo_atividades;
CREATE POLICY "rdo_atividades read" ON public.rdo_atividades FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_atividades.rdo_id AND public.user_em_obra(r.obra_id)));
CREATE POLICY "rdo_atividades write" ON public.rdo_atividades FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_atividades.rdo_id AND public.user_em_obra(r.obra_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_atividades.rdo_id AND public.user_em_obra(r.obra_id)));

CREATE TABLE IF NOT EXISTS public.rdo_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_ocorrencias TO authenticated;
GRANT ALL ON public.rdo_ocorrencias TO service_role;
ALTER TABLE public.rdo_ocorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo_ocorrencias read" ON public.rdo_ocorrencias;
DROP POLICY IF EXISTS "rdo_ocorrencias write" ON public.rdo_ocorrencias;
CREATE POLICY "rdo_ocorrencias read" ON public.rdo_ocorrencias FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_ocorrencias.rdo_id AND public.user_em_obra(r.obra_id)));
CREATE POLICY "rdo_ocorrencias write" ON public.rdo_ocorrencias FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_ocorrencias.rdo_id AND public.user_em_obra(r.obra_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_ocorrencias.rdo_id AND public.user_em_obra(r.obra_id)));

CREATE TABLE IF NOT EXISTS public.rdo_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rdo_id uuid NOT NULL REFERENCES public.rdo(id) ON DELETE CASCADE,
  storage_path text NOT NULL DEFAULT '',
  legenda text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_fotos TO authenticated;
GRANT ALL ON public.rdo_fotos TO service_role;
ALTER TABLE public.rdo_fotos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdo_fotos read" ON public.rdo_fotos;
DROP POLICY IF EXISTS "rdo_fotos write" ON public.rdo_fotos;
CREATE POLICY "rdo_fotos read" ON public.rdo_fotos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_fotos.rdo_id AND public.user_em_obra(r.obra_id)));
CREATE POLICY "rdo_fotos write" ON public.rdo_fotos FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_fotos.rdo_id AND public.user_em_obra(r.obra_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.rdo r WHERE r.id = rdo_fotos.rdo_id AND public.user_em_obra(r.obra_id)));

CREATE INDEX IF NOT EXISTS idx_rdo_obra_data ON public.rdo(obra_id, data);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rdo_numero_documental_unique ON public.rdo(numero_documental) WHERE numero_documental IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rdo_efetivo_rdo ON public.rdo_efetivo(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_rdo ON public.rdo_atividades(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_cron ON public.rdo_atividades(cronograma_item_id);
CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_rdo ON public.rdo_ocorrencias(rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_fotos_rdo ON public.rdo_fotos(rdo_id);

DROP TRIGGER IF EXISTS trg_rdo_updated_at ON public.rdo;
CREATE TRIGGER trg_rdo_updated_at
BEFORE UPDATE ON public.rdo
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.rdo_assert_not_fechado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rdo_id uuid;
  v_fechado_em timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'rdo' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.fechado_em IS NOT NULL THEN
      RAISE EXCEPTION 'RDO fechado não pode ser alterado.' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_rdo_id := OLD.rdo_id;
  ELSE
    v_rdo_id := NEW.rdo_id;
  END IF;

  SELECT r.fechado_em INTO v_fechado_em FROM public.rdo r WHERE r.id = v_rdo_id;

  IF v_fechado_em IS NOT NULL THEN
    RAISE EXCEPTION 'RDO fechado não permite alterar itens vinculados.' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.rdo_assert_not_fechado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rdo_assert_not_fechado() TO service_role;

DROP TRIGGER IF EXISTS trg_rdo_assert_not_fechado ON public.rdo;
CREATE TRIGGER trg_rdo_assert_not_fechado BEFORE UPDATE OR DELETE ON public.rdo FOR EACH ROW EXECUTE FUNCTION public.rdo_assert_not_fechado();
DROP TRIGGER IF EXISTS trg_rdo_efetivo_assert_not_fechado ON public.rdo_efetivo;
CREATE TRIGGER trg_rdo_efetivo_assert_not_fechado BEFORE INSERT OR UPDATE OR DELETE ON public.rdo_efetivo FOR EACH ROW EXECUTE FUNCTION public.rdo_assert_not_fechado();
DROP TRIGGER IF EXISTS trg_rdo_atividades_assert_not_fechado ON public.rdo_atividades;
CREATE TRIGGER trg_rdo_atividades_assert_not_fechado BEFORE INSERT OR UPDATE OR DELETE ON public.rdo_atividades FOR EACH ROW EXECUTE FUNCTION public.rdo_assert_not_fechado();
DROP TRIGGER IF EXISTS trg_rdo_ocorrencias_assert_not_fechado ON public.rdo_ocorrencias;
CREATE TRIGGER trg_rdo_ocorrencias_assert_not_fechado BEFORE INSERT OR UPDATE OR DELETE ON public.rdo_ocorrencias FOR EACH ROW EXECUTE FUNCTION public.rdo_assert_not_fechado();
DROP TRIGGER IF EXISTS trg_rdo_fotos_assert_not_fechado ON public.rdo_fotos;
CREATE TRIGGER trg_rdo_fotos_assert_not_fechado BEFORE INSERT OR UPDATE OR DELETE ON public.rdo_fotos FOR EACH ROW EXECUTE FUNCTION public.rdo_assert_not_fechado();

CREATE OR REPLACE FUNCTION public.rdo_fechar_assinar(p_rdo_id uuid, p_numero_documental text, p_assinado_por text, p_assinatura_sha256 text)
RETURNS public.rdo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.rdo;
  v_after public.rdo;
  v_assinado_por text;
BEGIN
  v_assinado_por := nullif(btrim(coalesce(p_assinado_por, '')), '');
  IF p_rdo_id IS NULL THEN RAISE EXCEPTION 'RDO obrigatório.' USING ERRCODE = '22023'; END IF;
  IF v_assinado_por IS NULL THEN RAISE EXCEPTION 'Responsável pela assinatura obrigatório.' USING ERRCODE = '22023'; END IF;
  IF p_numero_documental IS NULL OR p_numero_documental !~ '^RDO-[0-9]{4}-[0-9]{4}$' THEN RAISE EXCEPTION 'Número documental inválido.' USING ERRCODE = '22023'; END IF;
  IF p_assinatura_sha256 IS NULL OR p_assinatura_sha256 !~ '^sha256:[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Identificador da assinatura inválido.' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_before FROM public.rdo WHERE id = p_rdo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RDO não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.user_em_obra(v_before.obra_id) THEN RAISE EXCEPTION 'Sem permissão para fechar este RDO.' USING ERRCODE = '42501'; END IF;
  IF v_before.fechado_em IS NOT NULL THEN RAISE EXCEPTION 'RDO já está fechado.' USING ERRCODE = 'P0001'; END IF;

  UPDATE public.rdo
  SET numero_documental = p_numero_documental,
      status = 'fechado',
      fechado_em = now(),
      fechado_por = v_assinado_por,
      assinado_em = now(),
      assinado_por = v_assinado_por,
      assinatura_sha256 = p_assinatura_sha256,
      synced_at = now()
  WHERE id = p_rdo_id
  RETURNING * INTO v_after;

  INSERT INTO public.audit_logs(obra_id, entidade, entidade_id, acao, before, after, user_id)
  VALUES (
    v_after.obra_id,
    'rdo',
    v_after.id,
    'update',
    jsonb_build_object('status', v_before.status, 'fechado_em', v_before.fechado_em, 'assinado_em', v_before.assinado_em),
    jsonb_build_object('status', v_after.status, 'numero_documental', v_after.numero_documental, 'fechado_em', v_after.fechado_em, 'fechado_por', v_after.fechado_por, 'assinado_em', v_after.assinado_em, 'assinado_por', v_after.assinado_por, 'assinatura_sha256', v_after.assinatura_sha256),
    auth.uid()
  );

  RETURN v_after;
END;
$$;
REVOKE ALL ON FUNCTION public.rdo_fechar_assinar(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rdo_fechar_assinar(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rdo_fechar_assinar(uuid, text, text, text) TO service_role;