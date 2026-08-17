
-- =====================================================================
-- FASE 1 — Módulo de Cards de Recurso (pool único)
-- TODO(auth): toda a RLS está como USING(true)/WITH CHECK(true) por
-- decisão explícita. Migrar para policies reais (membership por setor)
-- quando Supabase Auth + RLS forem decididos no projeto.
-- =====================================================================

-- ---------- Sequence global para numero legível dos cards ------------
CREATE SEQUENCE IF NOT EXISTS public.cards_numero_seq START 1;

-- ---------- card_grupos_negociacao (antes de cards p/ FK) ------------
CREATE TABLE public.card_grupos_negociacao (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_grupos_negociacao TO anon, authenticated;
GRANT ALL ON public.card_grupos_negociacao TO service_role;
ALTER TABLE public.card_grupos_negociacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_grupos_negociacao acesso"
  ON public.card_grupos_negociacao
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- ---------- cards (pool único) ---------------------------------------
CREATE TABLE public.cards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero             BIGINT NOT NULL DEFAULT nextval('public.cards_numero_seq'),
  tipo               TEXT NOT NULL DEFAULT 'recurso'
                       CHECK (tipo IN ('recurso','generico')),
  titulo             TEXT NOT NULL DEFAULT '',
  descricao          TEXT,
  status             TEXT NOT NULL DEFAULT 'identificado',
  obra_id            UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  cronograma_item_id UUID REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  grupo_negociacao_id UUID REFERENCES public.card_grupos_negociacao(id) ON DELETE SET NULL,
  criado_por         TEXT NOT NULL DEFAULT '',
  arquivado          BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero)
);

ALTER SEQUENCE public.cards_numero_seq OWNED BY public.cards.numero;

CREATE INDEX idx_cards_obra_arq ON public.cards (obra_id, arquivado);
CREATE INDEX idx_cards_crono_item ON public.cards (cronograma_item_id);
CREATE INDEX idx_cards_status ON public.cards (status);
CREATE INDEX idx_cards_tipo ON public.cards (tipo);
CREATE INDEX idx_cards_grupo_neg ON public.cards (grupo_negociacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO anon, authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards acesso"
  ON public.cards
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_cards_touch
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- card_recursos (1:1 com cards de tipo 'recurso') ----------
CREATE TABLE public.card_recursos (
  card_id              UUID PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  tipo_recurso         TEXT NOT NULL
                         CHECK (tipo_recurso IN ('material_pronto','manufaturado','servico','equipamento')),
  quantidade           NUMERIC(14,3),
  unidade              TEXT,
  especificacao        TEXT,
  local_entrega        TEXT NOT NULL DEFAULT 'obra'
                         CHECK (local_entrega IN ('obra','almoxarifado','outro')),
  data_inicio_atividade DATE NOT NULL,
  data_necessidade_obra DATE NOT NULL,
  prazo_notif_compras   DATE NOT NULL,
  prazo_pedido          DATE NOT NULL,
  prazo_notif_producao  DATE,
  prazo_prod_iniciar    DATE,
  valor_estimado       NUMERIC(14,2),
  valor_oc             NUMERIC(14,2),
  status_aprovacao     TEXT NOT NULL DEFAULT 'nao_aplicavel'
                         CHECK (status_aprovacao IN ('nao_aplicavel','pendente','aprovado','rejeitado')),
  threshold_aprovacao  NUMERIC(14,2),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_recursos_tipo ON public.card_recursos (tipo_recurso);
CREATE INDEX idx_card_recursos_notif ON public.card_recursos (prazo_notif_compras);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_recursos TO anon, authenticated;
GRANT ALL ON public.card_recursos TO service_role;
ALTER TABLE public.card_recursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_recursos acesso"
  ON public.card_recursos
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_card_recursos_touch
  BEFORE UPDATE ON public.card_recursos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- card_comentarios ----------------------------------------
CREATE TABLE public.card_comentarios (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  autor      TEXT NOT NULL DEFAULT '',
  texto      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_coment_card ON public.card_comentarios (card_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_comentarios TO anon, authenticated;
GRANT ALL ON public.card_comentarios TO service_role;
ALTER TABLE public.card_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_comentarios acesso"
  ON public.card_comentarios
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- ---------- card_checklist_itens ------------------------------------
CREATE TABLE public.card_checklist_itens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  grupo      TEXT NOT NULL DEFAULT 'Geral',
  texto      TEXT NOT NULL,
  concluido  BOOLEAN NOT NULL DEFAULT false,
  ordem      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_check_card ON public.card_checklist_itens (card_id, grupo, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_checklist_itens TO anon, authenticated;
GRANT ALL ON public.card_checklist_itens TO service_role;
ALTER TABLE public.card_checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_checklist_itens acesso"
  ON public.card_checklist_itens
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- ---------- card_anexos ---------------------------------------------
CREATE TABLE public.card_anexos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho      BIGINT,
  mime         TEXT,
  enviado_por  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_card_anexos_card ON public.card_anexos (card_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_anexos TO anon, authenticated;
GRANT ALL ON public.card_anexos TO service_role;
ALTER TABLE public.card_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_anexos acesso"
  ON public.card_anexos
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- ---------- card_setores (multi-setor) ------------------------------
CREATE TABLE public.card_setores (
  card_id      UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  setor        TEXT NOT NULL
                 CHECK (setor IN ('Engenharia','Compras','Contratos','RH','Producao','Financeiro','Geral')),
  subsetor     TEXT CHECK (subsetor IN ('Solda','Corte','Dobra')),
  status_setor TEXT,
  PRIMARY KEY (card_id, setor)
);
CREATE INDEX idx_card_setores_setor ON public.card_setores (setor);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_setores TO anon, authenticated;
GRANT ALL ON public.card_setores TO service_role;
ALTER TABLE public.card_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_setores acesso"
  ON public.card_setores
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

-- ---------- lead_time_templates -------------------------------------
CREATE TABLE public.lead_time_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_recurso        TEXT NOT NULL
                        CHECK (tipo_recurso IN ('material_pronto','manufaturado','servico','equipamento')),
  obra_id             UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  dias_necessidade    INTEGER NOT NULL DEFAULT 1,
  dias_pedido         INTEGER NOT NULL DEFAULT 5,
  dias_notif_compras  INTEGER NOT NULL DEFAULT 5,
  dias_prod_iniciar   INTEGER,
  dias_notif_producao INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- UNIQUE só funciona com NULL via índice parcial + expressão
CREATE UNIQUE INDEX uq_lead_time_tipo_obra
  ON public.lead_time_templates (tipo_recurso, COALESCE(obra_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_time_templates TO anon, authenticated;
GRANT ALL ON public.lead_time_templates TO service_role;
ALTER TABLE public.lead_time_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_time_templates acesso"
  ON public.lead_time_templates
  FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_lead_time_templates_touch
  BEFORE UPDATE ON public.lead_time_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed dos templates globais (obra_id = NULL)
INSERT INTO public.lead_time_templates
  (tipo_recurso, obra_id, dias_necessidade, dias_pedido, dias_notif_compras, dias_prod_iniciar, dias_notif_producao)
VALUES
  ('material_pronto', NULL, 1, 5, 5, NULL, NULL),
  ('manufaturado',    NULL, 1, 5, 5, 5,    2),
  ('servico',         NULL, 1, 7, 10, NULL, NULL),
  ('equipamento',     NULL, 1, 3, 3, NULL, NULL);

-- ---------- Desnormalização no cronograma ---------------------------
ALTER TABLE public.cronograma_itens
  ADD COLUMN recursos_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN recursos_status TEXT NOT NULL DEFAULT 'sem_recursos'
    CHECK (recursos_status IN ('sem_recursos','ok','atencao','critico','concluido'));

-- ---------- Função/trigger: sync cronograma ⇄ cards de recurso ------
CREATE OR REPLACE FUNCTION public.fn_card_recurso_sync_crono(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count    INTEGER := 0;
  v_status   TEXT    := 'sem_recursos';
  v_hoje     DATE    := CURRENT_DATE;
  v_critico  INTEGER := 0;
  v_atencao  INTEGER := 0;
  v_abertos  INTEGER := 0;
BEGIN
  IF p_item_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.cards c
   WHERE c.cronograma_item_id = p_item_id
     AND c.tipo = 'recurso'
     AND c.arquivado = false;

  IF v_count = 0 THEN
    UPDATE public.cronograma_itens
       SET recursos_count = 0, recursos_status = 'sem_recursos'
     WHERE id = p_item_id;
    RETURN;
  END IF;

  -- Conta cards "abertos" (não concluídos)
  SELECT
    COUNT(*) FILTER (WHERE c.status NOT IN ('concluido')),
    COUNT(*) FILTER (
      WHERE c.status NOT IN ('concluido')
        AND r.prazo_notif_compras < v_hoje
    ),
    COUNT(*) FILTER (
      WHERE c.status IN ('em_cotacao','pedido_emitido','aguardando_entrega',
                         'aguardando_material','em_fabricacao')
    )
  INTO v_abertos, v_critico, v_atencao
  FROM public.cards c
  LEFT JOIN public.card_recursos r ON r.card_id = c.id
  WHERE c.cronograma_item_id = p_item_id
    AND c.tipo = 'recurso'
    AND c.arquivado = false;

  IF v_critico > 0 THEN
    v_status := 'critico';
  ELSIF v_atencao > 0 THEN
    v_status := 'atencao';
  ELSIF v_abertos = 0 THEN
    v_status := 'concluido';
  ELSE
    v_status := 'ok';
  END IF;

  UPDATE public.cronograma_itens
     SET recursos_count = v_count, recursos_status = v_status
   WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_cards_sync_crono()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.fn_card_recurso_sync_crono(OLD.cronograma_item_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.cronograma_item_id IS DISTINCT FROM OLD.cronograma_item_id THEN
      PERFORM public.fn_card_recurso_sync_crono(OLD.cronograma_item_id);
    END IF;
    PERFORM public.fn_card_recurso_sync_crono(NEW.cronograma_item_id);
    RETURN NEW;
  ELSE
    PERFORM public.fn_card_recurso_sync_crono(NEW.cronograma_item_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_cards_sync_crono_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.trg_cards_sync_crono();

-- Quando card_recursos.prazo_* muda, recalcular o status da linha
CREATE OR REPLACE FUNCTION public.trg_card_recursos_sync_crono()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_item UUID;
BEGIN
  SELECT cronograma_item_id INTO v_item FROM public.cards
   WHERE id = COALESCE(NEW.card_id, OLD.card_id);
  PERFORM public.fn_card_recurso_sync_crono(v_item);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_card_recursos_sync_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.card_recursos
  FOR EACH ROW EXECUTE FUNCTION public.trg_card_recursos_sync_crono();
