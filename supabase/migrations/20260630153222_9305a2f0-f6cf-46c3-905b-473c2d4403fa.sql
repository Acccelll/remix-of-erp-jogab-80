-- Criação atômica de card em quadro/lista e correção de acesso pós-criação.

CREATE OR REPLACE FUNCTION public.has_card_access(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.card_setores cs
      WHERE cs.card_id = p_card_id
        AND cs.setor = ANY(public.current_setores())
    )
    OR EXISTS (
      SELECT 1
      FROM public.card_board_posicao cbp
      JOIN public.boards b ON b.id = cbp.board_id
      LEFT JOIN public.board_membros bm
        ON bm.board_id = b.id
       AND bm.user_id = auth.uid()
      WHERE cbp.card_id = p_card_id
        AND b.arquivado = false
        AND (
          ((b.tipo = 'setor') AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
          OR ((b.tipo = 'obra') AND array_length(public.current_setores(), 1) IS NOT NULL)
          OR ((b.tipo = 'custom') AND (b.owner_id = auth.uid() OR bm.user_id IS NOT NULL))
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.has_card_setor(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_card_access(p_card_id);
$$;

CREATE OR REPLACE FUNCTION public.criar_card_board_atomico(
  p_board_id uuid,
  p_lista_id uuid,
  p_titulo text,
  p_criado_por text DEFAULT ''
)
RETURNS TABLE(card_id uuid, numero bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_board record;
  v_card_id uuid;
  v_numero bigint;
  v_posicao integer;
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário autenticado é obrigatório.' USING ERRCODE = '28000';
  END IF;

  IF v_titulo IS NULL THEN
    RAISE EXCEPTION 'Título do card é obrigatório.' USING ERRCODE = '22023';
  END IF;

  SELECT b.id, b.nome, b.tipo, b.setor, b.obra_id, b.owner_id, b.arquivado
    INTO v_board
  FROM public.boards b
  WHERE b.id = p_board_id;

  IF NOT FOUND OR coalesce(v_board.arquivado, false) THEN
    RAISE EXCEPTION 'Quadro não encontrado ou arquivado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.board_listas bl
    WHERE bl.id = p_lista_id
      AND bl.board_id = p_board_id
      AND bl.arquivada = false
  ) THEN
    RAISE EXCEPTION 'Lista não encontrada neste quadro.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.current_is_gm()
    OR ((v_board.tipo = 'setor') AND v_board.setor IS NOT NULL AND public.current_has_setor(v_board.setor))
    OR ((v_board.tipo = 'obra') AND array_length(public.current_setores(), 1) IS NOT NULL)
    OR ((v_board.tipo = 'custom') AND (
      v_board.owner_id = v_actor OR EXISTS (
        SELECT 1 FROM public.board_membros bm
        WHERE bm.board_id = p_board_id AND bm.user_id = v_actor
      )
    ))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar card neste quadro.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(max(cbp.posicao), -1) + 1
    INTO v_posicao
  FROM public.card_board_posicao cbp
  WHERE cbp.board_id = p_board_id
    AND cbp.lista_id = p_lista_id
    AND cbp.arquivada = false;

  INSERT INTO public.cards (tipo, titulo, status, obra_id, criado_por)
  VALUES ('generico', v_titulo, 'aberto', v_board.obra_id, coalesce(nullif(p_criado_por, ''), 'sistema'))
  RETURNING id, cards.numero INTO v_card_id, v_numero;

  IF v_board.tipo = 'setor' AND v_board.setor IS NOT NULL THEN
    INSERT INTO public.card_setores (card_id, setor)
    VALUES (v_card_id, v_board.setor)
    ON CONFLICT (card_id, setor) DO NOTHING;
  END IF;

  INSERT INTO public.card_board_posicao (card_id, board_id, lista_id, posicao)
  VALUES (v_card_id, p_board_id, p_lista_id, v_posicao)
  ON CONFLICT (card_id, board_id) DO UPDATE
    SET lista_id = excluded.lista_id,
        posicao = excluded.posicao,
        arquivada = false,
        updated_at = now();

  INSERT INTO public.card_atividades (card_id, ator_id, ator_nome, evento, detalhe)
  VALUES (
    v_card_id,
    v_actor,
    coalesce(nullif(p_criado_por, ''), 'Sistema'),
    'criado',
    jsonb_build_object('titulo', v_titulo, 'lista_id', p_lista_id, 'board_id', p_board_id)
  );

  RETURN QUERY SELECT v_card_id, v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) TO service_role;