-- Kanban (system design §5.3/§8, item 6.4): estende a camada de vínculos
-- polimórficos (ETAPA 2) a Contratos/Locações e Patrimônios (MySQL) e
-- Romaneios (Postgres), pré-requisito pra migrar as 3 telas "Quadro"
-- bespoke pra cima da infraestrutura real do Kanban.
--
-- Achado bloqueante (registrado no documento de design): `contratos` e
-- `patrimonios` no MySQL têm PK inteira auto-incremento (confirmado em
-- api.php via `$conn->lastInsertId()`), não UUID — não cabiam em
-- `entity_id uuid`. Resolvido trocando `entity_id` para `text` (aceita
-- tanto um UUID Postgres quanto um inteiro-como-string do MySQL na mesma
-- coluna) — mesmo padrão de referência solta cross-banco já usado no
-- projeto (ex. `financeiro_previsao_carrinho_itens.solicitacao_id`).
--
-- Segunda limitação, deliberada: `kanban_entidade_info` é uma função
-- Postgres e não tem como consultar o MySQL em tempo real (sem
-- dblink/pg_net/FDW, que não existem neste projeto). Para `locacao` e
-- `patrimonio`, a função confia na existência informada pelo chamador
-- (`existe = true`) em vez de validar contra uma fonte — resolução de
-- nome/situação fica por conta do adapter no frontend, que já consulta o
-- MySQL de verdade via `api.php`. Romaneio é Postgres nativo e continua
-- validado normalmente.

ALTER TABLE public.card_entity_links ALTER COLUMN entity_id TYPE text USING entity_id::text;
ALTER TABLE public.kanban_extensao_log ALTER COLUMN entity_id TYPE text USING entity_id::text;

DROP FUNCTION IF EXISTS public.kanban_entidade_info(text, uuid);
CREATE OR REPLACE FUNCTION public.kanban_entidade_info(p_entity_type text, p_entity_id text)
RETURNS TABLE (existe boolean, nome text, empresa_id uuid, arquivada boolean, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_entity_type = 'obra' THEN
    RETURN QUERY
      SELECT true, o.nome, o.empresa_id, COALESCE(o.ativa, true) = false, COALESCE(o.status,'')
      FROM public.obras o WHERE o.id = p_entity_id::uuid;
  ELSIF p_entity_type = 'cronograma_item' THEN
    RETURN QUERY
      SELECT true, ci.descricao, o.empresa_id, COALESCE(ci.ativo, true) = false, ''::text
      FROM public.cronograma_itens ci
      LEFT JOIN public.obras o ON o.id = ci.obra_id
      WHERE ci.id = p_entity_id::uuid;
  ELSIF p_entity_type = 'usuario' THEN
    RETURN QUERY
      SELECT true, COALESCE(p.login, p.email), NULL::uuid, false, ''::text
      FROM public.profiles p WHERE p.id = p_entity_id::uuid;
  ELSIF p_entity_type = 'romaneio' THEN
    RETURN QUERY
      SELECT true, r.numero, o.empresa_id, r.status = 'cancelado', r.status
      FROM public.romaneios r
      LEFT JOIN public.obras o ON o.id = r.obra_destino_id
      WHERE r.id = p_entity_id::uuid;
  ELSIF p_entity_type IN ('locacao', 'patrimonio') THEN
    -- Fonte é MySQL (api.php) — sem acesso de leitura direto daqui. Confia
    -- no chamador (já validado pela rota MySQL) em vez de rejeitar por
    -- falta de mecanismo de verificação; nome/situação resolvidos no
    -- frontend via adapter (src/lib/quadros/extensoes/adapters.ts).
    RETURN QUERY SELECT true, NULL::text, NULL::uuid, false, ''::text;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, false, ''::text;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.card_entity_link_criar(uuid,text,text,uuid,text,boolean,jsonb);
CREATE OR REPLACE FUNCTION public.card_entity_link_criar(
  p_card_id uuid,
  p_extensao text,
  p_entity_type text,
  p_entity_id text,
  p_relationship_type text DEFAULT 'relacionado',
  p_is_primary boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_info record;
  v_ext record;
  v_id uuid;
  v_empresa uuid;
  v_ordem integer;
  v_nome text;
BEGIN
  IF NOT public.card_pode_editar(p_card_id) THEN
    INSERT INTO public.kanban_extensao_log(card_id, extensao_codigo, entity_type, entity_id, acao, resultado, ator_id)
    VALUES (p_card_id, p_extensao, p_entity_type, p_entity_id, 'vinculo_criar', 'negado', auth.uid());
    RAISE EXCEPTION 'Sem permissão para vincular entidades a este card.';
  END IF;

  SELECT * INTO v_ext FROM public.kanban_extensoes WHERE codigo = p_extensao;
  IF v_ext IS NULL OR NOT v_ext.ativo THEN
    RAISE EXCEPTION 'Extensão % indisponível.', p_extensao;
  END IF;
  IF NOT (p_entity_type = ANY (v_ext.entity_types)) THEN
    RAISE EXCEPTION 'Tipo de entidade % não é suportado pela extensão %.', p_entity_type, p_extensao;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.card_board_posicao cbp
    JOIN public.board_extensoes be ON be.board_id = cbp.board_id AND be.extensao_codigo = p_extensao
    WHERE cbp.card_id = p_card_id AND be.ativo = false
  ) AND NOT EXISTS (
    SELECT 1 FROM public.card_board_posicao cbp
    JOIN public.board_extensoes be ON be.board_id = cbp.board_id AND be.extensao_codigo = p_extensao
    WHERE cbp.card_id = p_card_id AND be.ativo
  ) THEN
    RAISE EXCEPTION 'Extensão % está desativada nos quadros deste card.', p_extensao;
  END IF;

  SELECT * INTO v_info FROM public.kanban_entidade_info(p_entity_type, p_entity_id);
  IF v_info IS NULL OR NOT v_info.existe THEN
    RAISE EXCEPTION 'Entidade % % não encontrada.', p_entity_type, p_entity_id;
  END IF;
  IF v_info.arquivada THEN
    RAISE EXCEPTION 'Entidade arquivada não pode receber novos vínculos.';
  END IF;
  v_empresa := v_info.empresa_id;
  -- Fonte MySQL não devolve nome (ver kanban_entidade_info) — usa o nome de
  -- exibição que o adapter do frontend já resolveu, se enviado.
  v_nome := COALESCE(v_info.nome, p_metadata->>'nome_exibicao');

  IF v_empresa IS NOT NULL AND NOT public.is_current_player_gm() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_empresas ue
      WHERE ue.user_id = auth.uid() AND ue.empresa_id = v_empresa
    ) THEN
      INSERT INTO public.kanban_extensao_log(card_id, extensao_codigo, entity_type, entity_id, acao, resultado, ator_id)
      VALUES (p_card_id, p_extensao, p_entity_type, p_entity_id, 'vinculo_criar', 'negado_empresa', auth.uid());
      RAISE EXCEPTION 'Entidade pertence a outra empresa.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.card_entity_links l
    WHERE l.card_id = p_card_id AND l.entity_type = p_entity_type
      AND l.entity_id = p_entity_id AND l.relationship_type = COALESCE(p_relationship_type,'relacionado')
      AND l.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Vínculo duplicado.';
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1 INTO v_ordem
  FROM public.card_entity_links WHERE card_id = p_card_id AND archived_at IS NULL;

  IF p_is_primary THEN
    UPDATE public.card_entity_links SET is_primary = false, updated_at = now()
    WHERE card_id = p_card_id AND is_primary AND archived_at IS NULL;
  END IF;

  INSERT INTO public.card_entity_links(
    card_id, extensao_codigo, entity_type, entity_id, relationship_type,
    is_primary, display_order, empresa_id, metadata, created_by, updated_by)
  VALUES (p_card_id, p_extensao, p_entity_type, p_entity_id, COALESCE(p_relationship_type,'relacionado'),
    COALESCE(p_is_primary,false), v_ordem, v_empresa, COALESCE(p_metadata,'{}'::jsonb), auth.uid(), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.kanban_extensao_log(card_id, extensao_codigo, entity_type, entity_id, acao, resultado, ator_id, metadata)
  VALUES (p_card_id, p_extensao, p_entity_type, p_entity_id, 'vinculo_criar', 'ok', auth.uid(),
          jsonb_build_object('link_id', v_id, 'nome', v_nome));

  INSERT INTO public.card_atividades(card_id, evento, detalhe, ator_id)
  VALUES (p_card_id, 'vinculo_criado',
          jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'nome', v_nome, 'extensao', p_extensao),
          auth.uid());

  RETURN v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.card_entity_links_listar(uuid);
CREATE OR REPLACE FUNCTION public.card_entity_links_listar(p_card_id uuid)
RETURNS TABLE (
  id uuid, extensao_codigo text, entity_type text, entity_id text,
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
         CASE WHEN acesso.ok THEN COALESCE(i.nome, l.metadata->>'nome_exibicao') ELSE NULL END,
         COALESCE(i.existe, false),
         COALESCE(i.arquivada, false),
         l.empresa_id,
         acesso.ok,
         l.created_by,
         (SELECT COALESCE(p.login, p.email) FROM public.profiles p WHERE p.id = l.created_by),
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

DROP FUNCTION IF EXISTS public.cards_por_entidade(text, uuid);
CREATE OR REPLACE FUNCTION public.cards_por_entidade(p_entity_type text, p_entity_id text)
RETURNS TABLE (card_id uuid, numero bigint, titulo text, status text, arquivado boolean, board_id uuid, board_nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.numero, c.titulo, c.status, c.arquivado, b.id, b.nome
  FROM public.card_entity_links l
  JOIN public.cards c ON c.id = l.card_id
  LEFT JOIN public.card_board_posicao cbp ON cbp.card_id = c.id
  LEFT JOIN public.boards b ON b.id = cbp.board_id
  WHERE l.entity_type = p_entity_type AND l.entity_id = p_entity_id AND l.archived_at IS NULL
  ORDER BY c.arquivado, c.numero;
$$;

REVOKE ALL ON FUNCTION public.kanban_entidade_info(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kanban_entidade_info(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.card_entity_link_criar(uuid,text,text,text,text,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.card_entity_link_criar(uuid,text,text,text,text,boolean,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.card_entity_links_listar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.card_entity_links_listar(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.cards_por_entidade(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cards_por_entidade(text,text) TO authenticated;

-- Novas extensões: Locações/Contratos (MySQL), Patrimônios (MySQL), Romaneios (Postgres).
INSERT INTO public.kanban_extensoes (codigo, nome, descricao, icone, versao, modulo, entity_types, ordem)
VALUES
  ('locacao','Locações','Vincula o card a um contrato de locação (equipamento/serviço) do ERP.','FileSignature','1.0.0','contratos','{locacao}',40),
  ('patrimonio','Patrimônios','Vincula o card a um patrimônio do ERP.','Boxes','1.0.0','patrimonios','{patrimonio}',50),
  ('romaneio','Romaneios','Vincula o card a um romaneio de logística de ativos.','Truck','1.0.0','logistica_ativos','{romaneio}',60)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone,
      modulo = EXCLUDED.modulo, entity_types = EXCLUDED.entity_types, updated_at = now();
