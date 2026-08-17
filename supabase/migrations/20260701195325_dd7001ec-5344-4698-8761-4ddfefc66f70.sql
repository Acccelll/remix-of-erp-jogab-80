-- Horizonte backend: fechar 6 achados não-linter restantes (RLS amplo / PII / finanças)

-- 0) Menor superfície: tabelas operacionais sensíveis não devem aceitar chamadas anônimas diretas.
REVOKE ALL ON TABLE public.colaboradores FROM anon;
REVOKE ALL ON TABLE public.clientes FROM anon;
REVOKE ALL ON TABLE public.cards FROM anon;
REVOKE ALL ON TABLE public.financeiro_lancamentos FROM anon;
REVOKE ALL ON TABLE public.restricoes FROM anon;
REVOKE ALL ON TABLE public.pacotes_trabalho FROM anon;
REVOKE ALL ON TABLE public.compromissos_semanais FROM anon;
REVOKE ALL ON TABLE public.pacote_restricoes FROM anon;
REVOKE ALL ON TABLE public.causas_nao_conclusao FROM anon;

-- Mantém a aplicação autenticada operando nas tabelas já usadas pelo front.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.colaboradores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financeiro_lancamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.restricoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pacotes_trabalho TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.compromissos_semanais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pacote_restricoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.causas_nao_conclusao TO authenticated;

-- 1) Colaboradores: remover dependência de user_pode_editar_obra, que inclui escopo por empresa.
DROP POLICY IF EXISTS "colaboradores select por rh autorizado da obra ou gm" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores write por rh autorizado da obra ou gm" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores select por rh da obra ou gm" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores write por rh da obra ou gm" ON public.colaboradores;

CREATE POLICY "colaboradores select rh membro direto ou gm"
ON public.colaboradores
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = obra_atual_id::uuid
    )
  )
);

CREATE POLICY "colaboradores write rh membro direto ou gm"
ON public.colaboradores
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = obra_atual_id::uuid
        AND om.papel IN ('gestor', 'membro')
    )
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = obra_atual_id::uuid
        AND om.papel IN ('gestor', 'membro')
    )
  )
);

-- 2) Clientes: remover leitura por qualquer usuário da obra; manter somente GM/Financeiro.
DROP POLICY IF EXISTS "clientes select por financeiro gm ou obra" ON public.clientes;
DROP POLICY IF EXISTS "cli_read" ON public.clientes;
DROP POLICY IF EXISTS "cli_write" ON public.clientes;

CREATE POLICY "clientes select financeiro ou gm"
ON public.clientes
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro'));

CREATE POLICY "clientes write financeiro ou gm"
ON public.clientes
FOR ALL
TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));

-- 3) Financeiro: razão financeiro não deve ser visível a qualquer membro da obra.
DROP POLICY IF EXISTS "financeiro_lancamentos_select_fin" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "fin_lanc_write" ON public.financeiro_lancamentos;

CREATE POLICY "financeiro_lancamentos select financeiro ou gm"
ON public.financeiro_lancamentos
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro'));

CREATE POLICY "financeiro_lancamentos write financeiro ou gm"
ON public.financeiro_lancamentos
FOR ALL
TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));

-- 4) Quadros/Listas/Posições: troca de user_pode_editar_obra por vínculo direto em obra_membros.
DROP POLICY IF EXISTS "boards write por escopo" ON public.boards;
CREATE POLICY "boards write por escopo direto"
ON public.boards
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (tipo = 'setor' AND setor IS NOT NULL AND public.current_has_setor(setor))
  OR (
    tipo = 'obra'
    AND obra_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = boards.obra_id
        AND om.papel IN ('gestor', 'membro')
    )
  )
  OR (tipo = 'custom' AND owner_id = auth.uid())
)
WITH CHECK (
  public.current_is_gm()
  OR (tipo = 'setor' AND setor IS NOT NULL AND public.current_has_setor(setor))
  OR (
    tipo = 'obra'
    AND obra_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = boards.obra_id
        AND om.papel IN ('gestor', 'membro')
    )
  )
  OR (tipo = 'custom' AND owner_id = auth.uid())
);

DROP POLICY IF EXISTS "board_listas write por board editavel" ON public.board_listas;
CREATE POLICY "board_listas write por board direto"
ON public.board_listas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_listas.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (
          b.tipo = 'obra'
          AND b.obra_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.obra_membros om
            WHERE om.user_id = auth.uid()
              AND om.obra_id = b.obra_id
              AND om.papel IN ('gestor', 'membro')
          )
        )
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_listas.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (
          b.tipo = 'obra'
          AND b.obra_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.obra_membros om
            WHERE om.user_id = auth.uid()
              AND om.obra_id = b.obra_id
              AND om.papel IN ('gestor', 'membro')
          )
        )
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "cbp write por board editavel" ON public.card_board_posicao;
CREATE POLICY "cbp write por board direto"
ON public.card_board_posicao
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = card_board_posicao.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (
          b.tipo = 'obra'
          AND b.obra_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.obra_membros om
            WHERE om.user_id = auth.uid()
              AND om.obra_id = b.obra_id
              AND om.papel IN ('gestor', 'membro')
          )
        )
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = card_board_posicao.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (
          b.tipo = 'obra'
          AND b.obra_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.obra_membros om
            WHERE om.user_id = auth.uid()
              AND om.obra_id = b.obra_id
              AND om.papel IN ('gestor', 'membro')
          )
        )
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

-- 5) Cards: criação direta deixa de ser "qualquer autenticado".
DROP POLICY IF EXISTS "cards insert" ON public.cards;
CREATE POLICY "cards insert por autoria e escopo"
ON public.cards
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_gm()
  OR (
    auth.uid() IS NOT NULL
    AND criado_por = auth.uid()::text
    AND (
      obra_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.obra_membros om
        WHERE om.user_id = auth.uid()
          AND om.obra_id = cards.obra_id
          AND om.papel IN ('gestor', 'membro')
      )
    )
  )
);

-- 6) Planejamento Lean: leitura e escrita por obra; causas só GM altera.
DROP POLICY IF EXISTS "pacotes_select_auth" ON public.pacotes_trabalho;
DROP POLICY IF EXISTS "pacotes_write_auth" ON public.pacotes_trabalho;
CREATE POLICY "pacotes select por obra"
ON public.pacotes_trabalho
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));
CREATE POLICY "pacotes write por obra"
ON public.pacotes_trabalho
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.obra_membros om
    WHERE om.user_id = auth.uid()
      AND om.obra_id = pacotes_trabalho.obra_id
      AND om.papel IN ('gestor', 'membro')
  )
)
WITH CHECK (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.obra_membros om
    WHERE om.user_id = auth.uid()
      AND om.obra_id = pacotes_trabalho.obra_id
      AND om.papel IN ('gestor', 'membro')
  )
);

DROP POLICY IF EXISTS "restricoes_write_auth" ON public.restricoes;
CREATE POLICY "restricoes write por obra"
ON public.restricoes
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.obra_membros om
    WHERE om.user_id = auth.uid()
      AND om.obra_id = restricoes.obra_id
      AND om.papel IN ('gestor', 'membro')
  )
)
WITH CHECK (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.obra_membros om
    WHERE om.user_id = auth.uid()
      AND om.obra_id = restricoes.obra_id
      AND om.papel IN ('gestor', 'membro')
  )
);

DROP POLICY IF EXISTS "compromissos_select_auth" ON public.compromissos_semanais;
DROP POLICY IF EXISTS "compromissos_write_auth" ON public.compromissos_semanais;
CREATE POLICY "compromissos select por obra"
ON public.compromissos_semanais
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));
CREATE POLICY "compromissos write por obra"
ON public.compromissos_semanais
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.obra_membros om
    WHERE om.user_id = auth.uid()
      AND om.obra_id = compromissos_semanais.obra_id
      AND om.papel IN ('gestor', 'membro')
  )
)
WITH CHECK (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.obra_membros om
    WHERE om.user_id = auth.uid()
      AND om.obra_id = compromissos_semanais.obra_id
      AND om.papel IN ('gestor', 'membro')
  )
);

DROP POLICY IF EXISTS "pacote_restricoes_select_auth" ON public.pacote_restricoes;
DROP POLICY IF EXISTS "pacote_restricoes_write_auth" ON public.pacote_restricoes;
CREATE POLICY "pacote_restricoes select por obra"
ON public.pacote_restricoes
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1
    FROM public.pacotes_trabalho p
    JOIN public.restricoes r ON r.id = pacote_restricoes.restricao_id
    WHERE p.id = pacote_restricoes.pacote_id
      AND p.obra_id = r.obra_id
      AND public.user_em_obra(p.obra_id)
  )
);
CREATE POLICY "pacote_restricoes write por obra"
ON public.pacote_restricoes
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1
    FROM public.pacotes_trabalho p
    JOIN public.restricoes r ON r.id = pacote_restricoes.restricao_id
    JOIN public.obra_membros om ON om.obra_id = p.obra_id
    WHERE p.id = pacote_restricoes.pacote_id
      AND p.obra_id = r.obra_id
      AND om.user_id = auth.uid()
      AND om.papel IN ('gestor', 'membro')
  )
)
WITH CHECK (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1
    FROM public.pacotes_trabalho p
    JOIN public.restricoes r ON r.id = pacote_restricoes.restricao_id
    JOIN public.obra_membros om ON om.obra_id = p.obra_id
    WHERE p.id = pacote_restricoes.pacote_id
      AND p.obra_id = r.obra_id
      AND om.user_id = auth.uid()
      AND om.papel IN ('gestor', 'membro')
  )
);

DROP POLICY IF EXISTS "causas_write_auth" ON public.causas_nao_conclusao;
CREATE POLICY "causas write gm"
ON public.causas_nao_conclusao
FOR ALL
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());

-- Reaplica criar_card_board_atomico para alinhar a autorização da RPC ao escopo direto de obra.
CREATE OR REPLACE FUNCTION public.criar_card_board_atomico(p_board_id uuid, p_lista_id uuid, p_titulo text, p_criado_por text DEFAULT ''::text)
RETURNS TABLE(card_id uuid, numero bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_board record;
  v_card_id uuid;
  v_numero bigint;
  v_posicao integer;
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL AND auth.role() <> 'service_role' THEN
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
    SELECT 1 FROM public.board_listas bl
    WHERE bl.id = p_lista_id AND bl.board_id = p_board_id AND bl.arquivada = false
  ) THEN
    RAISE EXCEPTION 'Lista não encontrada neste quadro.' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() <> 'service_role' AND NOT (
    public.current_is_gm()
    OR (v_board.tipo = 'setor' AND v_board.setor IS NOT NULL AND public.current_has_setor(v_board.setor))
    OR (
      v_board.tipo = 'obra'
      AND v_board.obra_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.obra_membros om
        WHERE om.user_id = v_actor
          AND om.obra_id = v_board.obra_id
          AND om.papel IN ('gestor', 'membro')
      )
    )
    OR (v_board.tipo = 'custom' AND (
      v_board.owner_id = v_actor OR EXISTS (
        SELECT 1 FROM public.board_membros bm WHERE bm.board_id = p_board_id AND bm.user_id = v_actor
      )
    ))
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar card neste quadro.' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(max(cbp.posicao), -1) + 1 INTO v_posicao
  FROM public.card_board_posicao cbp
  WHERE cbp.board_id = p_board_id AND cbp.lista_id = p_lista_id AND cbp.arquivada = false;

  INSERT INTO public.cards (tipo, titulo, status, obra_id, criado_por)
  VALUES ('generico', v_titulo, 'aberto', v_board.obra_id, coalesce(v_actor::text, nullif(p_criado_por, ''), 'sistema'))
  RETURNING cards.id, cards.numero INTO v_card_id, v_numero;

  IF v_board.tipo = 'setor' AND v_board.setor IS NOT NULL THEN
    INSERT INTO public.card_setores (card_id, setor)
    VALUES (v_card_id, v_board.setor)
    ON CONFLICT (card_id, setor) DO NOTHING;
  END IF;

  INSERT INTO public.card_board_posicao (card_id, board_id, lista_id, posicao)
  VALUES (v_card_id, p_board_id, p_lista_id, v_posicao)
  ON CONFLICT (card_id, board_id) DO UPDATE
    SET lista_id = excluded.lista_id, posicao = excluded.posicao, arquivada = false, updated_at = now();

  INSERT INTO public.card_atividades (card_id, ator_id, ator_nome, evento, detalhe)
  VALUES (v_card_id, v_actor, coalesce(nullif(p_criado_por, ''), 'Sistema'), 'criado',
          jsonb_build_object('titulo', v_titulo, 'lista_id', p_lista_id, 'board_id', p_board_id));

  RETURN QUERY SELECT v_card_id, v_numero;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_card_board_atomico(uuid, uuid, text, text) TO service_role;