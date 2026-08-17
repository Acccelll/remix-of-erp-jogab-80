-- ETAPA 1 · Consolidação do Kanban genérico
-- Idempotente: pode ser reaplicada com segurança.

-- 1) BOARDS -----------------------------------------------------------------
ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS fundo_cor text,
  ADD COLUMN IF NOT EXISTS fundo_url text,
  ADD COLUMN IF NOT EXISTS visibilidade text NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.boards
    ADD CONSTRAINT boards_visibilidade_chk
    CHECK (visibilidade IN ('privado','membros','setor','empresa'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) FAVORITOS ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.board_favoritos (
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.board_favoritos TO authenticated;
GRANT ALL ON public.board_favoritos TO service_role;
ALTER TABLE public.board_favoritos ENABLE ROW LEVEL SECURITY;

-- 3) LISTAS ------------------------------------------------------------------
ALTER TABLE public.board_listas
  ADD COLUMN IF NOT EXISTS estado_operacional text,
  ADD COLUMN IF NOT EXISTS ordenacao text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.board_listas.estado_operacional IS
  'Identificador interno opcional (ex.: OC_EMITIDA). Independente do nome visivel. Sem regra de negocio na Etapa 1.';

-- 4) ETIQUETAS POR QUADRO -----------------------------------------------------
ALTER TABLE public.card_labels
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ordem numeric NOT NULL DEFAULT 0;

-- 5) CAMPOS PERSONALIZADOS ----------------------------------------------------
ALTER TABLE public.board_campos
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_frente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_padrao text;

-- 6) AUTOMACOES DE QUADRO (migra do localStorage) -----------------------------
CREATE TABLE IF NOT EXISTS public.board_automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativa boolean NOT NULL DEFAULT true,
  gatilho jsonb NOT NULL,
  acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_automacoes TO authenticated;
GRANT ALL ON public.board_automacoes TO service_role;
ALTER TABLE public.board_automacoes ENABLE ROW LEVEL SECURITY;

-- 7) FUNCOES DE ACESSO --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.board_papel(_board_id uuid, _user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.boards b WHERE b.id = _board_id AND b.owner_id = _user_id) THEN 'admin'
    ELSE (SELECT m.papel FROM public.board_membros m
          WHERE m.board_id = _board_id AND m.user_id = _user_id LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_board(_board_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = _board_id
      AND (
        b.visibilidade = 'empresa'
        OR b.owner_id = _user_id
        OR EXISTS (SELECT 1 FROM public.board_membros m
                   WHERE m.board_id = b.id AND m.user_id = _user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_admin_board(_board_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.board_papel(_board_id, _user_id) = 'admin'
$$;

-- 8) POLICIES -----------------------------------------------------------------
DROP POLICY IF EXISTS board_favoritos_own ON public.board_favoritos;
CREATE POLICY board_favoritos_own ON public.board_favoritos
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS board_automacoes_select ON public.board_automacoes;
CREATE POLICY board_automacoes_select ON public.board_automacoes
  FOR SELECT TO authenticated
  USING (public.pode_ver_board(board_id, auth.uid()));

DROP POLICY IF EXISTS board_automacoes_write ON public.board_automacoes;
CREATE POLICY board_automacoes_write ON public.board_automacoes
  FOR ALL TO authenticated
  USING (public.pode_ver_board(board_id, auth.uid()))
  WITH CHECK (public.pode_ver_board(board_id, auth.uid()));

-- 9) INDICES ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cbp_board_lista_pos
  ON public.card_board_posicao (board_id, lista_id, posicao);
CREATE INDEX IF NOT EXISTS idx_board_listas_board_pos
  ON public.board_listas (board_id, posicao);
CREATE INDEX IF NOT EXISTS idx_card_labels_board
  ON public.card_labels (board_id, ordem);
CREATE INDEX IF NOT EXISTS idx_card_comentarios_card
  ON public.card_comentarios (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_atividades_card
  ON public.card_atividades (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_board_automacoes_board
  ON public.board_automacoes (board_id);

-- 10) TRIGGER updated_at ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_board_automacoes_updated ON public.board_automacoes;
CREATE TRIGGER trg_board_automacoes_updated BEFORE UPDATE ON public.board_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();