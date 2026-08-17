
-- =========================================================
-- FASE A — Boards / Listas / Posição por quadro
-- =========================================================

-- 1) boards
CREATE TABLE IF NOT EXISTS public.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('setor','obra','custom')),
  setor TEXT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  arquivado BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT boards_tipo_ref_chk CHECK (
    (tipo = 'setor'  AND setor IS NOT NULL AND obra_id IS NULL) OR
    (tipo = 'obra'   AND obra_id IS NOT NULL AND setor IS NULL) OR
    (tipo = 'custom' AND setor IS NULL AND obra_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_boards_setor ON public.boards(setor) WHERE tipo = 'setor';
CREATE UNIQUE INDEX IF NOT EXISTS uq_boards_obra  ON public.boards(obra_id) WHERE tipo = 'obra';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boards select" ON public.boards;
CREATE POLICY "boards select" ON public.boards FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR (tipo = 'setor'  AND setor IS NOT NULL AND public.current_has_setor(setor))
  OR (tipo = 'obra'   AND array_length(public.current_setores(), 1) IS NOT NULL)
  OR (tipo = 'custom' AND owner_id = auth.uid())
);
DROP POLICY IF EXISTS "boards write" ON public.boards;
CREATE POLICY "boards write" ON public.boards FOR ALL TO authenticated
USING (
  public.current_is_gm()
  OR (tipo = 'setor' AND setor IS NOT NULL AND public.current_has_setor(setor))
  OR (tipo = 'obra'  AND array_length(public.current_setores(), 1) IS NOT NULL)
  OR (tipo = 'custom' AND owner_id = auth.uid())
)
WITH CHECK (
  public.current_is_gm()
  OR (tipo = 'setor' AND setor IS NOT NULL AND public.current_has_setor(setor))
  OR (tipo = 'obra'  AND array_length(public.current_setores(), 1) IS NOT NULL)
  OR (tipo = 'custom' AND owner_id = auth.uid())
);

-- 2) board_listas
CREATE TABLE IF NOT EXISTS public.board_listas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  posicao INTEGER NOT NULL DEFAULT 0,
  wip_limite INTEGER,
  arquivada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_listas_board ON public.board_listas(board_id, posicao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_listas TO authenticated;
GRANT ALL ON public.board_listas TO service_role;
ALTER TABLE public.board_listas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "board_listas select" ON public.board_listas;
CREATE POLICY "board_listas select" ON public.board_listas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_listas.board_id));
DROP POLICY IF EXISTS "board_listas write" ON public.board_listas;
CREATE POLICY "board_listas write" ON public.board_listas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_listas.board_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_listas.board_id));

-- 3) card_board_posicao
CREATE TABLE IF NOT EXISTS public.card_board_posicao (
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  lista_id UUID REFERENCES public.board_listas(id) ON DELETE SET NULL,
  posicao INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, board_id)
);
CREATE INDEX IF NOT EXISTS idx_cbp_board_lista ON public.card_board_posicao(board_id, lista_id, posicao);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_board_posicao TO authenticated;
GRANT ALL ON public.card_board_posicao TO service_role;
ALTER TABLE public.card_board_posicao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cbp select" ON public.card_board_posicao;
CREATE POLICY "cbp select" ON public.card_board_posicao FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = card_board_posicao.board_id));
DROP POLICY IF EXISTS "cbp write" ON public.card_board_posicao;
CREATE POLICY "cbp write" ON public.card_board_posicao FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = card_board_posicao.board_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.boards b WHERE b.id = card_board_posicao.board_id));

-- 4) updated_at triggers
DROP TRIGGER IF EXISTS trg_boards_updated ON public.boards;
CREATE TRIGGER trg_boards_updated BEFORE UPDATE ON public.boards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_board_listas_updated ON public.board_listas;
CREATE TRIGGER trg_board_listas_updated BEFORE UPDATE ON public.board_listas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cbp_updated ON public.card_board_posicao;
CREATE TRIGGER trg_cbp_updated BEFORE UPDATE ON public.card_board_posicao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 5) Seed/migração idempotente
-- =========================================================
DO $mig$
DECLARE
  v_board_id UUID;
  v_lista_fazer UUID;
  v_lista_andamento UUID;
  v_lista_aguardando UUID;
  v_lista_concluido UUID;
  v_lista_bloqueado UUID;
  v_target_lista UUID;
  r_setor RECORD;
  r_obra RECORD;
  r_card RECORD;
BEGIN
  -- 5a) Boards de setor
  FOR r_setor IN
    SELECT DISTINCT cs.setor
    FROM public.card_setores cs
    WHERE cs.setor IS NOT NULL
  LOOP
    INSERT INTO public.boards (nome, tipo, setor)
    VALUES ('Setor: ' || r_setor.setor, 'setor', r_setor.setor)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_board_id FROM public.boards WHERE tipo='setor' AND setor = r_setor.setor;

    -- listas default
    IF NOT EXISTS (SELECT 1 FROM public.board_listas WHERE board_id = v_board_id) THEN
      INSERT INTO public.board_listas (board_id, nome, posicao) VALUES
        (v_board_id, 'A fazer',      0),
        (v_board_id, 'Em andamento', 1),
        (v_board_id, 'Aguardando',   2),
        (v_board_id, 'Concluído',    3);
    END IF;
  END LOOP;

  -- 5b) Boards de obra
  FOR r_obra IN
    SELECT DISTINCT c.obra_id, o.nome
    FROM public.cards c
    JOIN public.obras o ON o.id = c.obra_id
    WHERE c.obra_id IS NOT NULL
  LOOP
    INSERT INTO public.boards (nome, tipo, obra_id)
    VALUES ('Obra: ' || r_obra.nome, 'obra', r_obra.obra_id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_board_id FROM public.boards WHERE tipo='obra' AND obra_id = r_obra.obra_id;

    IF NOT EXISTS (SELECT 1 FROM public.board_listas WHERE board_id = v_board_id) THEN
      INSERT INTO public.board_listas (board_id, nome, posicao) VALUES
        (v_board_id, 'A fazer',      0),
        (v_board_id, 'Em andamento', 1),
        (v_board_id, 'Aguardando',   2),
        (v_board_id, 'Bloqueado',    3),
        (v_board_id, 'Concluído',    4);
    END IF;
  END LOOP;

  -- 5c) Popular card_board_posicao a partir do status atual + setores/obra
  FOR v_board_id IN SELECT id FROM public.boards LOOP
    SELECT id INTO v_lista_fazer      FROM public.board_listas WHERE board_id = v_board_id AND nome = 'A fazer'      LIMIT 1;
    SELECT id INTO v_lista_andamento  FROM public.board_listas WHERE board_id = v_board_id AND nome = 'Em andamento' LIMIT 1;
    SELECT id INTO v_lista_aguardando FROM public.board_listas WHERE board_id = v_board_id AND nome = 'Aguardando'   LIMIT 1;
    SELECT id INTO v_lista_concluido  FROM public.board_listas WHERE board_id = v_board_id AND nome = 'Concluído'    LIMIT 1;
    SELECT id INTO v_lista_bloqueado  FROM public.board_listas WHERE board_id = v_board_id AND nome = 'Bloqueado'    LIMIT 1;

    FOR r_card IN
      SELECT c.id, c.status
      FROM public.cards c
      WHERE c.arquivado IS NOT TRUE
        AND (
          EXISTS (
            SELECT 1 FROM public.boards b
            WHERE b.id = v_board_id
              AND (
                (b.tipo = 'setor' AND EXISTS (SELECT 1 FROM public.card_setores cs WHERE cs.card_id = c.id AND cs.setor = b.setor))
                OR (b.tipo = 'obra' AND c.obra_id = b.obra_id)
              )
          )
        )
    LOOP
      v_target_lista := CASE r_card.status
        WHEN 'aberto'       THEN v_lista_fazer
        WHEN 'em_andamento' THEN v_lista_andamento
        WHEN 'aguardando'   THEN v_lista_aguardando
        WHEN 'concluido'    THEN v_lista_concluido
        ELSE v_lista_fazer
      END;
      IF v_target_lista IS NULL THEN
        v_target_lista := v_lista_fazer;
      END IF;

      INSERT INTO public.card_board_posicao (card_id, board_id, lista_id, posicao)
      VALUES (r_card.id, v_board_id, v_target_lista, 0)
      ON CONFLICT (card_id, board_id) DO NOTHING;
    END LOOP;
  END LOOP;
END
$mig$;
