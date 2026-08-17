CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'custom',
  setor text,
  obra_id uuid,
  owner_id uuid,
  arquivado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.board_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  posicao numeric NOT NULL DEFAULT 0,
  wip_limite integer,
  cor text,
  arquivada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_listas_board ON public.board_listas(board_id, posicao);

CREATE TABLE public.board_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, user_id)
);

CREATE TABLE public.board_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto',
  opcoes jsonb,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_campos_board ON public.board_campos(board_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_listas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_membros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_campos TO authenticated;
GRANT ALL ON public.boards TO service_role;
GRANT ALL ON public.board_listas TO service_role;
GRANT ALL ON public.board_membros TO service_role;
GRANT ALL ON public.board_campos TO service_role;

CREATE OR REPLACE FUNCTION public.is_board_member(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_membros bm
    WHERE bm.board_id = _board_id AND bm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = _board_id AND b.owner_id = auth.uid()
  );
$$;

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boards_select" ON public.boards FOR SELECT TO authenticated USING (true);
CREATE POLICY "boards_insert" ON public.boards FOR INSERT TO authenticated
  WITH CHECK (public.is_current_player_gm() OR owner_id = auth.uid());
CREATE POLICY "boards_update" ON public.boards FOR UPDATE TO authenticated
  USING (public.is_current_player_gm() OR public.is_board_member(id))
  WITH CHECK (public.is_current_player_gm() OR public.is_board_member(id));
CREATE POLICY "boards_delete" ON public.boards FOR DELETE TO authenticated
  USING (public.is_current_player_gm() OR owner_id = auth.uid());

CREATE POLICY "board_listas_select" ON public.board_listas FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_listas_write" ON public.board_listas FOR ALL TO authenticated
  USING (public.is_current_player_gm() OR public.is_board_member(board_id))
  WITH CHECK (public.is_current_player_gm() OR public.is_board_member(board_id));

CREATE POLICY "board_membros_select" ON public.board_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_membros_write" ON public.board_membros FOR ALL TO authenticated
  USING (public.is_current_player_gm() OR public.is_board_member(board_id))
  WITH CHECK (public.is_current_player_gm() OR public.is_board_member(board_id));

CREATE POLICY "board_campos_select" ON public.board_campos FOR SELECT TO authenticated USING (true);
CREATE POLICY "board_campos_write" ON public.board_campos FOR ALL TO authenticated
  USING (public.is_current_player_gm() OR public.is_board_member(board_id))
  WITH CHECK (public.is_current_player_gm() OR public.is_board_member(board_id));

CREATE TRIGGER trg_boards_updated BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_board_listas_updated BEFORE UPDATE ON public.board_listas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DELETE FROM public.card_board_posicao
 WHERE board_id NOT IN (SELECT id FROM public.boards)
    OR lista_id NOT IN (SELECT id FROM public.board_listas);

ALTER TABLE public.card_board_posicao
  ADD CONSTRAINT card_board_posicao_board_fk FOREIGN KEY (board_id) REFERENCES public.boards(id) ON DELETE CASCADE,
  ADD CONSTRAINT card_board_posicao_lista_fk FOREIGN KEY (lista_id) REFERENCES public.board_listas(id) ON DELETE CASCADE;