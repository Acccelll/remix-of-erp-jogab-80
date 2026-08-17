-- Empresas e vínculos por empresa
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  ativa boolean NOT NULL DEFAULT true,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "empresas_auth_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_auth_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_auth_update" ON public.empresas;
DROP POLICY IF EXISTS "empresas_auth_delete" ON public.empresas;
CREATE POLICY "empresas_auth_select" ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresas_auth_insert" ON public.empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "empresas_auth_update" ON public.empresas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "empresas_auth_delete" ON public.empresas FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.user_empresas (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'operador' CHECK (papel IN ('gestor','operador','viewer','admin','membro','observador')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_empresas TO authenticated;
GRANT ALL ON public.user_empresas TO service_role;
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_empresas_auth_select" ON public.user_empresas;
DROP POLICY IF EXISTS "user_empresas_auth_insert" ON public.user_empresas;
DROP POLICY IF EXISTS "user_empresas_auth_update" ON public.user_empresas;
DROP POLICY IF EXISTS "user_empresas_auth_delete" ON public.user_empresas;
CREATE POLICY "user_empresas_auth_select" ON public.user_empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_empresas_auth_insert" ON public.user_empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "user_empresas_auth_update" ON public.user_empresas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "user_empresas_auth_delete" ON public.user_empresas FOR DELETE TO authenticated USING (true);

ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_obras_empresa_id ON public.obras(empresa_id);

-- Tipos lógicos usados por Quadros/Cards
DO $$ BEGIN
  CREATE TYPE public.board_tipo AS ENUM ('setor','obra','custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.card_tipo AS ENUM ('generico','recurso','restricao','risco','licao','rdo','nc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.card_status AS ENUM ('aberto','em_andamento','bloqueado','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Quadros
CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo public.board_tipo NOT NULL DEFAULT 'custom',
  setor text,
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  arquivado boolean NOT NULL DEFAULT false,
  origem_externa text,
  origem_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boards_tipo_contexto_chk CHECK (
    (tipo = 'setor' AND setor IS NOT NULL AND obra_id IS NULL)
    OR (tipo = 'obra' AND obra_id IS NOT NULL)
    OR (tipo = 'custom')
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boards_auth_select" ON public.boards;
DROP POLICY IF EXISTS "boards_auth_insert" ON public.boards;
DROP POLICY IF EXISTS "boards_auth_update" ON public.boards;
DROP POLICY IF EXISTS "boards_auth_delete" ON public.boards;
CREATE POLICY "boards_auth_select" ON public.boards FOR SELECT TO authenticated USING (true);
CREATE POLICY "boards_auth_insert" ON public.boards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "boards_auth_update" ON public.boards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "boards_auth_delete" ON public.boards FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_boards_tipo ON public.boards(tipo);
CREATE INDEX IF NOT EXISTS idx_boards_obra_id ON public.boards(obra_id);

CREATE TABLE IF NOT EXISTS public.board_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  posicao integer NOT NULL DEFAULT 0,
  wip_limite integer,
  arquivada boolean NOT NULL DEFAULT false,
  cor text,
  origem_externa text,
  origem_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_listas_wip_chk CHECK (wip_limite IS NULL OR wip_limite > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_listas TO authenticated;
GRANT ALL ON public.board_listas TO service_role;
ALTER TABLE public.board_listas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "board_listas_auth_select" ON public.board_listas;
DROP POLICY IF EXISTS "board_listas_auth_insert" ON public.board_listas;
DROP POLICY IF EXISTS "board_listas_auth_update" ON public.board_listas;
DROP POLICY IF EXISTS "board_listas_auth_delete" ON public.board_listas;
CREATE POLICY "board_listas_auth_select" ON public.board_listas FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_listas_auth_insert" ON public.board_listas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "board_listas_auth_update" ON public.board_listas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "board_listas_auth_delete" ON public.board_listas FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_board_listas_board_pos ON public.board_listas(board_id, posicao);

-- Cards e relacionamentos principais
CREATE TABLE IF NOT EXISTS public.card_grupos_negociacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo text NOT NULL UNIQUE,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_grupos_negociacao TO authenticated;
GRANT ALL ON public.card_grupos_negociacao TO service_role;
ALTER TABLE public.card_grupos_negociacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_grupos_negociacao_auth_all" ON public.card_grupos_negociacao;
CREATE POLICY "card_grupos_negociacao_auth_all" ON public.card_grupos_negociacao FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE SEQUENCE IF NOT EXISTS public.cards_numero_seq;
GRANT USAGE, SELECT ON SEQUENCE public.cards_numero_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cards_numero_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.cards_numero_seq'),
  tipo public.card_tipo NOT NULL DEFAULT 'generico',
  titulo text NOT NULL,
  descricao text,
  status public.card_status NOT NULL DEFAULT 'aberto',
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_por text,
  data_inicio date,
  prazo date,
  lembrete timestamptz,
  due_complete boolean NOT NULL DEFAULT false,
  arquivado boolean NOT NULL DEFAULT false,
  posicao numeric,
  capa_cor text,
  capa_url text,
  cover_color text,
  cover_url text,
  cronograma_item_id uuid REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  grupo_negociacao_id uuid REFERENCES public.card_grupos_negociacao(id) ON DELETE SET NULL,
  origem_externa text,
  origem_id text,
  origem_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cards_auth_select" ON public.cards;
DROP POLICY IF EXISTS "cards_auth_insert" ON public.cards;
DROP POLICY IF EXISTS "cards_auth_update" ON public.cards;
DROP POLICY IF EXISTS "cards_auth_delete" ON public.cards;
CREATE POLICY "cards_auth_select" ON public.cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "cards_auth_insert" ON public.cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cards_auth_update" ON public.cards FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cards_auth_delete" ON public.cards FOR DELETE TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_cards_responsavel ON public.cards(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_cards_obra ON public.cards(obra_id);
CREATE INDEX IF NOT EXISTS idx_cards_origem ON public.cards(origem_externa, origem_id);

CREATE TABLE IF NOT EXISTS public.card_board_posicao (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  lista_id uuid REFERENCES public.board_listas(id) ON DELETE SET NULL,
  posicao numeric NOT NULL DEFAULT 0,
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, board_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_board_posicao TO authenticated;
GRANT ALL ON public.card_board_posicao TO service_role;
ALTER TABLE public.card_board_posicao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_board_posicao_auth_all" ON public.card_board_posicao;
CREATE POLICY "card_board_posicao_auth_all" ON public.card_board_posicao FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_card_board_posicao_board_lista ON public.card_board_posicao(board_id, lista_id, posicao);

CREATE TABLE IF NOT EXISTS public.card_setores (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  setor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, setor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_setores TO authenticated;
GRANT ALL ON public.card_setores TO service_role;
ALTER TABLE public.card_setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_setores_auth_all" ON public.card_setores;
CREATE POLICY "card_setores_auth_all" ON public.card_setores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nome, cor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_labels TO authenticated;
GRANT ALL ON public.card_labels TO service_role;
ALTER TABLE public.card_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_labels_auth_all" ON public.card_labels;
CREATE POLICY "card_labels_auth_all" ON public.card_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_label_links (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.card_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, label_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_label_links TO authenticated;
GRANT ALL ON public.card_label_links TO service_role;
ALTER TABLE public.card_label_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_label_links_auth_all" ON public.card_label_links;
CREATE POLICY "card_label_links_auth_all" ON public.card_label_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_checklist_itens TO authenticated;
GRANT ALL ON public.card_checklist_itens TO service_role;
ALTER TABLE public.card_checklist_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_checklist_itens_auth_all" ON public.card_checklist_itens;
CREATE POLICY "card_checklist_itens_auth_all" ON public.card_checklist_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_card_checklist_itens_card ON public.card_checklist_itens(card_id, ordem);

CREATE TABLE IF NOT EXISTS public.card_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  texto text NOT NULL,
  autor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nome text,
  parent_id uuid REFERENCES public.card_comentarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_comentarios TO authenticated;
GRANT ALL ON public.card_comentarios TO service_role;
ALTER TABLE public.card_comentarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_comentarios_auth_all" ON public.card_comentarios;
CREATE POLICY "card_comentarios_auth_all" ON public.card_comentarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_card_comentarios_card ON public.card_comentarios(card_id, created_at);

CREATE TABLE IF NOT EXISTS public.card_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
  ator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ator_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_atividades TO authenticated;
GRANT ALL ON public.card_atividades TO service_role;
ALTER TABLE public.card_atividades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_atividades_auth_all" ON public.card_atividades;
CREATE POLICY "card_atividades_auth_all" ON public.card_atividades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_card_atividades_card_created ON public.card_atividades(card_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.card_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  nome text,
  storage_path text NOT NULL,
  mime text,
  tamanho integer,
  autor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_anexos TO authenticated;
GRANT ALL ON public.card_anexos TO service_role;
ALTER TABLE public.card_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_anexos_auth_all" ON public.card_anexos;
CREATE POLICY "card_anexos_auth_all" ON public.card_anexos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_card_anexos_card ON public.card_anexos(card_id, created_at);

CREATE TABLE IF NOT EXISTS public.board_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('texto','numero','data','dropdown','checkbox')),
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_campos TO authenticated;
GRANT ALL ON public.board_campos TO service_role;
ALTER TABLE public.board_campos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "board_campos_auth_all" ON public.board_campos;
CREATE POLICY "board_campos_auth_all" ON public.board_campos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_board_campos_board ON public.board_campos(board_id, ordem);

CREATE TABLE IF NOT EXISTS public.card_custom_field_valores (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL REFERENCES public.board_campos(id) ON DELETE CASCADE,
  valor jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, campo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_custom_field_valores TO authenticated;
GRANT ALL ON public.card_custom_field_valores TO service_role;
ALTER TABLE public.card_custom_field_valores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_custom_field_valores_auth_all" ON public.card_custom_field_valores;
CREATE POLICY "card_custom_field_valores_auth_all" ON public.card_custom_field_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.board_membros (
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin','membro','observador')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_membros TO authenticated;
GRANT ALL ON public.board_membros TO service_role;
ALTER TABLE public.board_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "board_membros_auth_all" ON public.board_membros;
CREATE POLICY "board_membros_auth_all" ON public.board_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_views_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_views_salvas TO authenticated;
GRANT ALL ON public.card_views_salvas TO service_role;
ALTER TABLE public.card_views_salvas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_views_salvas_auth_all" ON public.card_views_salvas;
CREATE POLICY "card_views_salvas_auth_all" ON public.card_views_salvas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_membros_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  fonte text NOT NULL,
  external_id text,
  nome text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros_externos TO authenticated;
GRANT ALL ON public.card_membros_externos TO service_role;
ALTER TABLE public.card_membros_externos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_membros_externos_auth_all" ON public.card_membros_externos;
CREATE POLICY "card_membros_externos_auth_all" ON public.card_membros_externos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  tipo_recurso text,
  prazo_notif_compras date,
  prazo_pedido date,
  prazo_prod_iniciar date,
  prazo_notif_producao date,
  data_necessidade_obra date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_recursos TO authenticated;
GRANT ALL ON public.card_recursos TO service_role;
ALTER TABLE public.card_recursos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_recursos_auth_all" ON public.card_recursos;
CREATE POLICY "card_recursos_auth_all" ON public.card_recursos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_card_recursos_card ON public.card_recursos(card_id);

-- Triggers simples de updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'empresas','user_empresas','boards','board_listas','card_grupos_negociacao','cards',
    'card_board_posicao','card_labels','card_checklist_itens','card_comentarios',
    'board_campos','card_custom_field_valores','board_membros','card_views_salvas','card_recursos'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t, t);
  END LOOP;
END $$;

-- Funções usadas pelo board
CREATE OR REPLACE FUNCTION public.board_items_resumo(p_board_id uuid)
RETURNS TABLE(
  card_id uuid,
  lista_id uuid,
  posicao numeric,
  id uuid,
  numero integer,
  titulo text,
  obra_id uuid,
  capa_cor text,
  capa_url text,
  prazo date,
  responsavel_id uuid,
  responsavel_login text,
  setores text[],
  labels jsonb,
  checklist_total integer,
  checklist_concluido integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    cbp.card_id,
    cbp.lista_id,
    cbp.posicao,
    c.id,
    c.numero,
    c.titulo,
    c.obra_id,
    c.capa_cor,
    c.capa_url,
    c.prazo,
    c.responsavel_id,
    p.login AS responsavel_login,
    COALESCE(sec.setores, ARRAY[]::text[]) AS setores,
    COALESCE(lbl.labels, '[]'::jsonb) AS labels,
    COALESCE(chk.total, 0)::integer AS checklist_total,
    COALESCE(chk.concluido, 0)::integer AS checklist_concluido
  FROM public.card_board_posicao cbp
  JOIN public.cards c ON c.id = cbp.card_id
  LEFT JOIN public.profiles p ON p.id = c.responsavel_id
  LEFT JOIN LATERAL (
    SELECT array_agg(cs.setor ORDER BY cs.setor) AS setores
    FROM public.card_setores cs
    WHERE cs.card_id = c.id
  ) sec ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', cl.id, 'nome', cl.nome, 'cor', cl.cor) ORDER BY cl.nome) AS labels
    FROM public.card_label_links cll
    JOIN public.card_labels cl ON cl.id = cll.label_id
    WHERE cll.card_id = c.id
  ) lbl ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS total, count(*) FILTER (WHERE ci.concluido) AS concluido
    FROM public.card_checklist_itens ci
    WHERE ci.card_id = c.id
  ) chk ON true
  WHERE cbp.board_id = p_board_id
    AND cbp.arquivada = false
    AND c.arquivado = false
  ORDER BY cbp.posicao ASC, c.created_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.board_items_resumo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.board_items_resumo(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.board_atividades_recentes(p_board_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid,
  card_id uuid,
  evento text,
  ator_nome text,
  created_at timestamptz,
  detalhe jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.card_id, a.evento, a.ator_nome, a.created_at, a.detalhe
  FROM public.card_atividades a
  JOIN public.card_board_posicao cbp ON cbp.card_id = a.card_id
  WHERE cbp.board_id = p_board_id
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$$;
GRANT EXECUTE ON FUNCTION public.board_atividades_recentes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.board_atividades_recentes(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.criar_card_board_atomico(
  p_board_id uuid,
  p_lista_id uuid,
  p_titulo text,
  p_criado_por text DEFAULT 'sistema'
)
RETURNS public.cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card public.cards;
  v_pos numeric;
BEGIN
  IF NULLIF(trim(p_titulo), '') IS NULL THEN
    RAISE EXCEPTION 'Título obrigatório';
  END IF;

  SELECT COALESCE(MAX(posicao), 0) + 1024
    INTO v_pos
  FROM public.card_board_posicao
  WHERE board_id = p_board_id AND lista_id = p_lista_id;

  INSERT INTO public.cards (titulo, criado_por)
  VALUES (trim(p_titulo), p_criado_por)
  RETURNING * INTO v_card;

  INSERT INTO public.card_board_posicao (card_id, board_id, lista_id, posicao)
  VALUES (v_card.id, p_board_id, p_lista_id, v_pos);

  INSERT INTO public.card_atividades (card_id, evento, detalhe, ator_nome)
  VALUES (v_card.id, 'criado', jsonb_build_object('board_id', p_board_id, 'lista_id', p_lista_id), p_criado_por);

  RETURN v_card;
END;
$$;
GRANT EXECUTE ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) TO service_role;

-- Seed mínimo para a tela /quadros não ficar quebrada em bases remixadas vazias
WITH ins AS (
  INSERT INTO public.boards (nome, tipo)
  SELECT 'Geral', 'custom'::public.board_tipo
  WHERE NOT EXISTS (SELECT 1 FROM public.boards)
  RETURNING id
)
INSERT INTO public.board_listas (board_id, nome, posicao)
SELECT ins.id, v.nome, v.posicao
FROM ins
CROSS JOIN (VALUES ('A fazer', 0), ('Em andamento', 1024), ('Concluído', 2048)) AS v(nome, posicao);

INSERT INTO public.card_labels (nome, cor)
VALUES
  ('Urgente', '#ef4444'),
  ('Atenção', '#f59e0b'),
  ('Rotina', '#64748b')
ON CONFLICT (nome, cor) DO NOTHING;