CREATE OR REPLACE FUNCTION public.board_items_resumo(p_board_id uuid)
RETURNS TABLE (
  card_id uuid,
  lista_id uuid,
  posicao integer,
  id uuid,
  numero bigint,
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = p_board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND array_length(public.current_setores(), 1) IS NOT NULL)
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao quadro' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
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
      p.login AS responsavel_login
    FROM public.card_board_posicao cbp
    JOIN public.cards c ON c.id = cbp.card_id
    LEFT JOIN public.profiles p ON p.id = c.responsavel_id
    WHERE cbp.board_id = p_board_id
      AND cbp.arquivada = false
      AND (public.current_is_gm() OR public.has_card_access(c.id))
  ), setores AS (
    SELECT cs.card_id, array_agg(cs.setor ORDER BY cs.setor) AS setores
    FROM public.card_setores cs
    JOIN base b ON b.card_id = cs.card_id
    GROUP BY cs.card_id
  ), labels AS (
    SELECT cl.card_id,
      jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome, 'cor', l.cor) ORDER BY l.nome) AS labels
    FROM public.card_label_links cl
    JOIN public.card_labels l ON l.id = cl.label_id
    JOIN base b ON b.card_id = cl.card_id
    GROUP BY cl.card_id
  ), checklist AS (
    SELECT ci.card_id,
      count(*)::integer AS total,
      count(*) FILTER (WHERE ci.concluido)::integer AS concluido
    FROM public.card_checklist_itens ci
    JOIN base b ON b.card_id = ci.card_id
    GROUP BY ci.card_id
  )
  SELECT
    b.card_id,
    b.lista_id,
    b.posicao,
    b.id,
    b.numero,
    b.titulo,
    b.obra_id,
    b.capa_cor,
    b.capa_url,
    b.prazo,
    b.responsavel_id,
    b.responsavel_login,
    coalesce(s.setores, ARRAY[]::text[]) AS setores,
    coalesce(l.labels, '[]'::jsonb) AS labels,
    coalesce(ch.total, 0) AS checklist_total,
    coalesce(ch.concluido, 0) AS checklist_concluido
  FROM base b
  LEFT JOIN setores s ON s.card_id = b.card_id
  LEFT JOIN labels l ON l.card_id = b.card_id
  LEFT JOIN checklist ch ON ch.card_id = b.card_id
  ORDER BY b.posicao;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.board_items_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_items_resumo(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.board_atividades_recentes(p_board_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  card_id uuid,
  evento text,
  ator_nome text,
  created_at timestamptz,
  detalhe jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = p_board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND array_length(public.current_setores(), 1) IS NOT NULL)
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao quadro' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.card_id, a.evento, a.ator_nome, a.created_at, a.detalhe
  FROM public.card_atividades a
  JOIN public.card_board_posicao cbp ON cbp.card_id = a.card_id AND cbp.board_id = p_board_id
  JOIN public.cards c ON c.id = a.card_id
  WHERE cbp.arquivada = false
    AND (public.current_is_gm() OR public.has_card_access(c.id))
  ORDER BY a.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 200));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.board_atividades_recentes(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_atividades_recentes(uuid, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.board_items_resumo(uuid) IS 'Aggregated, access-checked Kanban card summary for a board.';
COMMENT ON FUNCTION public.board_atividades_recentes(uuid, integer) IS 'Aggregated, access-checked recent activity feed for a board.';