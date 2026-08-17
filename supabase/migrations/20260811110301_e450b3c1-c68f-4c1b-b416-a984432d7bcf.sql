CREATE OR REPLACE FUNCTION public.board_items_resumo(p_board_id uuid)
RETURNS TABLE(card_id uuid, lista_id uuid, posicao numeric, id uuid, numero bigint, titulo text, obra_id uuid, capa_cor text, capa_url text, prazo date, responsavel_id uuid, responsavel_login text, setores text[], labels jsonb, checklist_total bigint, checklist_concluido bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'nao autenticado';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.boards b
        WHERE b.id = p_board_id
          AND (
            b.visibilidade = ANY (ARRAY['empresa','setor'])
            OR b.owner_id = auth.uid()
            OR private.pode_ver_board(b.id, auth.uid())
          )
    ) THEN
        RAISE EXCEPTION 'sem acesso ao quadro';
    END IF;

    RETURN QUERY
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
        p.login as responsavel_login,
        (SELECT array_agg(cs.setor) FROM public.card_setores cs WHERE cs.card_id = c.id) as setores,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome, 'cor', l.cor))
             FROM public.card_label_links cll
             JOIN public.card_labels l ON l.id = cll.label_id
             WHERE cll.card_id = c.id),
            '[]'::jsonb
        ) as labels,
        (SELECT count(*) FROM public.card_checklist_itens cci WHERE cci.card_id = c.id) as checklist_total,
        (SELECT count(*) FROM public.card_checklist_itens cci WHERE cci.card_id = c.id AND cci.concluido = true) as checklist_concluido
    FROM public.card_board_posicao cbp
    JOIN public.cards c ON c.id = cbp.card_id
    LEFT JOIN public.profiles p ON p.id = c.responsavel_id
    WHERE cbp.board_id = p_board_id
    ORDER BY cbp.posicao ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.board_items_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_items_resumo(uuid) TO authenticated, service_role;