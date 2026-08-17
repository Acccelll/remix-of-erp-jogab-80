CREATE OR REPLACE FUNCTION public.kanban_entidade_info(p_entity_type text, p_entity_id uuid)
RETURNS TABLE (existe boolean, nome text, empresa_id uuid, arquivada boolean, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_entity_type = 'obra' THEN
    RETURN QUERY
      SELECT true, o.nome, o.empresa_id, COALESCE(o.ativa, true) = false, COALESCE(o.status::text,'')
      FROM public.obras o WHERE o.id = p_entity_id;
  ELSIF p_entity_type = 'cronograma_item' THEN
    RETURN QUERY
      SELECT true, ci.descricao, o.empresa_id, COALESCE(ci.ativo, true) = false, ''::text
      FROM public.cronograma_itens ci
      LEFT JOIN public.obras o ON o.id = ci.obra_id
      WHERE ci.id = p_entity_id;
  ELSIF p_entity_type = 'usuario' THEN
    RETURN QUERY
      SELECT true, COALESCE(p.nome, p.login), NULL::uuid, false, ''::text
      FROM public.profiles p WHERE p.id = p_entity_id;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, false, ''::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.card_entity_links_listar(p_card_id uuid)
RETURNS TABLE (
  id uuid, extensao_codigo text, entity_type text, entity_id uuid,
  relationship_type text, is_primary boolean, display_order integer,
  situacao text, entidade_nome text, entidade_disponivel boolean,
  entidade_arquivada boolean, empresa_id uuid, acesso_permitido boolean,
  created_by uuid, created_by_nome text, created_at timestamptz, archived_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.extensao_codigo, l.entity_type, l.entity_id, l.relationship_type,
         l.is_primary, l.display_order,
         CASE WHEN l.archived_at IS NOT NULL THEN 'arquivada'
              WHEN NOT COALESCE(i.existe,false) THEN 'quebrado'
              ELSE l.situacao END,
         CASE WHEN acesso.ok THEN i.nome ELSE NULL END,
         COALESCE(i.existe, false),
         COALESCE(i.arquivada, false),
         l.empresa_id,
         acesso.ok,
         l.created_by,
         (SELECT COALESCE(p.nome, p.login) FROM public.profiles p WHERE p.id = l.created_by),
         l.created_at, l.archived_at
  FROM public.card_entity_links l
  LEFT JOIN LATERAL public.kanban_entidade_info(l.entity_type, l.entity_id) i ON true
  LEFT JOIN LATERAL (
    SELECT (public.is_current_player_gm()
            OR l.empresa_id IS NULL
            OR EXISTS (SELECT 1 FROM public.user_empresas ue
                       WHERE ue.user_id = auth.uid() AND ue.empresa_id = l.empresa_id)) AS ok
  ) acesso ON true
  WHERE l.card_id = p_card_id
  ORDER BY l.archived_at NULLS FIRST, l.is_primary DESC, l.display_order, l.created_at;
END;
$$;