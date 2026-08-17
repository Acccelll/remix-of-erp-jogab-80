-- ============ ETAPA 2 · Camada de extensões e vínculos ============

-- 1. Catálogo de extensões
CREATE TABLE IF NOT EXISTS public.kanban_extensoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  icone text,
  versao text NOT NULL DEFAULT '1.0.0',
  modulo text,
  entity_types text[] NOT NULL DEFAULT '{}',
  card_tipos_compat text[] NOT NULL DEFAULT '{}',
  permissao_requerida text,
  config_padrao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kanban_extensoes TO authenticated;
GRANT ALL ON public.kanban_extensoes TO service_role;
ALTER TABLE public.kanban_extensoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_extensoes_select ON public.kanban_extensoes;
CREATE POLICY kanban_extensoes_select ON public.kanban_extensoes
  FOR SELECT TO authenticated USING (true);

-- 2. Extensões por quadro
CREATE TABLE IF NOT EXISTS public.board_extensoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  extensao_codigo text NOT NULL REFERENCES public.kanban_extensoes(codigo) ON UPDATE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  mostrar_resumo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, extensao_codigo)
);
CREATE INDEX IF NOT EXISTS idx_board_extensoes_board ON public.board_extensoes(board_id) WHERE ativo;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_extensoes TO authenticated;
GRANT ALL ON public.board_extensoes TO service_role;
ALTER TABLE public.board_extensoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS board_extensoes_select ON public.board_extensoes;
CREATE POLICY board_extensoes_select ON public.board_extensoes
  FOR SELECT TO authenticated USING (public.pode_ver_board(board_id, auth.uid()));
DROP POLICY IF EXISTS board_extensoes_write ON public.board_extensoes;
CREATE POLICY board_extensoes_write ON public.board_extensoes
  FOR ALL TO authenticated
  USING (public.is_current_player_gm() OR public.is_board_member(board_id))
  WITH CHECK (public.is_current_player_gm() OR public.is_board_member(board_id));

-- 3. Tipos de card
CREATE TABLE IF NOT EXISTS public.card_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  icone text,
  cor text,
  extensoes_padrao text[] NOT NULL DEFAULT '{}',
  sistema boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.card_tipos TO authenticated;
GRANT ALL ON public.card_tipos TO service_role;
ALTER TABLE public.card_tipos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS card_tipos_select ON public.card_tipos;
CREATE POLICY card_tipos_select ON public.card_tipos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS card_tipos_insert ON public.card_tipos;
CREATE POLICY card_tipos_insert ON public.card_tipos
  FOR INSERT TO authenticated WITH CHECK (public.is_current_player_gm());
DROP POLICY IF EXISTS card_tipos_update ON public.card_tipos;
CREATE POLICY card_tipos_update ON public.card_tipos
  FOR UPDATE TO authenticated USING (public.is_current_player_gm() AND NOT sistema);

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS card_tipo_id uuid REFERENCES public.card_tipos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cards_card_tipo ON public.cards(card_tipo_id) WHERE card_tipo_id IS NOT NULL;

-- 4. Vínculos genéricos card ↔ entidade do ERP
CREATE TABLE IF NOT EXISTS public.card_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  extensao_codigo text NOT NULL REFERENCES public.kanban_extensoes(codigo) ON UPDATE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  relationship_type text NOT NULL DEFAULT 'relacionado',
  is_primary boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  situacao text NOT NULL DEFAULT 'ok',
  empresa_id uuid,
  origem text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT card_entity_links_situacao_chk CHECK (situacao IN ('ok','arquivada','quebrado'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_entity_links_ativo
  ON public.card_entity_links(card_id, entity_type, entity_id, relationship_type)
  WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_card_entity_links_principal
  ON public.card_entity_links(card_id) WHERE is_primary AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cel_card ON public.card_entity_links(card_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cel_entity ON public.card_entity_links(entity_type, entity_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cel_extensao ON public.card_entity_links(extensao_codigo);
CREATE INDEX IF NOT EXISTS idx_cel_empresa ON public.card_entity_links(empresa_id);
GRANT SELECT ON public.card_entity_links TO authenticated;
GRANT ALL ON public.card_entity_links TO service_role;
ALTER TABLE public.card_entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS card_entity_links_select ON public.card_entity_links;
CREATE POLICY card_entity_links_select ON public.card_entity_links
  FOR SELECT TO authenticated USING (true);

-- 5. Log de auditoria da camada de extensões
CREATE TABLE IF NOT EXISTS public.kanban_extensao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid,
  card_id uuid,
  extensao_codigo text,
  entity_type text,
  entity_id uuid,
  acao text NOT NULL,
  resultado text NOT NULL DEFAULT 'ok',
  origem text NOT NULL DEFAULT 'app',
  ator_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kext_log_card ON public.kanban_extensao_log(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kext_log_board ON public.kanban_extensao_log(board_id, created_at DESC);
GRANT SELECT ON public.kanban_extensao_log TO authenticated;
GRANT ALL ON public.kanban_extensao_log TO service_role;
ALTER TABLE public.kanban_extensao_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kanban_extensao_log_select ON public.kanban_extensao_log;
CREATE POLICY kanban_extensao_log_select ON public.kanban_extensao_log
  FOR SELECT TO authenticated USING (true);

-- 6. Seeds do catálogo (idempotentes)
INSERT INTO public.kanban_extensoes (codigo, nome, descricao, icone, versao, modulo, entity_types, ordem)
VALUES
  ('obra','Obras','Vincula o card a uma obra do ERP.','Building2','1.0.0','obras','{obra}',10),
  ('cronograma','Cronograma','Vincula o card a atividades do cronograma (somente leitura nesta etapa).','CalendarRange','1.0.0','planejamento','{cronograma_item}',20),
  ('pessoas','Pessoas','Vincula o card a usuários responsáveis do ERP.','Users','1.0.0','core','{usuario}',30)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, descricao = EXCLUDED.descricao, icone = EXCLUDED.icone,
      modulo = EXCLUDED.modulo, entity_types = EXCLUDED.entity_types, updated_at = now();

INSERT INTO public.card_tipos (codigo, nome, descricao, icone, cor, sistema, ordem)
VALUES ('generico','Genérico','Card livre, sem regras de domínio.','Square', NULL, true, 0)
ON CONFLICT (codigo) DO NOTHING;

-- 7. Funções de apoio
CREATE OR REPLACE FUNCTION public.card_pode_editar(p_card_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_current_player_gm()
      OR EXISTS (
        SELECT 1 FROM public.card_board_posicao cbp
        WHERE cbp.card_id = p_card_id AND public.pode_ver_board(cbp.board_id, auth.uid())
      )
      OR NOT EXISTS (SELECT 1 FROM public.card_board_posicao cbp WHERE cbp.card_id = p_card_id);
$$;

CREATE OR REPLACE FUNCTION public.kanban_entidade_info(p_entity_type text, p_entity_id uuid)
RETURNS TABLE (existe boolean, nome text, empresa_id uuid, arquivada boolean, status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_entity_type = 'obra' THEN
    RETURN QUERY
      SELECT true, o.nome, o.empresa_id, COALESCE(o.ativa, true) = false, COALESCE(o.status,'')
      FROM public.obras o WHERE o.id = p_entity_id;
  ELSIF p_entity_type = 'cronograma_item' THEN
    RETURN QUERY
      SELECT true, ci.descricao, o.empresa_id, COALESCE(ci.ativo, true) = false, ''::text
      FROM public.cronograma_itens ci
      LEFT JOIN public.obras o ON o.id = ci.obra_id
      WHERE ci.id = p_entity_id;
  ELSIF p_entity_type = 'usuario' THEN
    RETURN QUERY
      SELECT true, COALESCE(p.login, p.email), NULL::uuid, false, ''::text
      FROM public.profiles p WHERE p.id = p_entity_id;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, false, ''::text;
  END IF;
END;
$$;

-- 8. Criar vínculo (validação server-side)
CREATE OR REPLACE FUNCTION public.card_entity_link_criar(
  p_card_id uuid,
  p_extensao text,
  p_entity_type text,
  p_entity_id uuid,
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
          jsonb_build_object('link_id', v_id, 'nome', v_info.nome));

  INSERT INTO public.card_atividades(card_id, evento, detalhe, ator_id)
  VALUES (p_card_id, 'vinculo_criado',
          jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'nome', v_info.nome, 'extensao', p_extensao),
          auth.uid());

  RETURN v_id;
END;
$$;

-- 9. Remover/arquivar vínculo
CREATE OR REPLACE FUNCTION public.card_entity_link_remover(p_link_id uuid, p_arquivar boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_link record;
BEGIN
  SELECT * INTO v_link FROM public.card_entity_links WHERE id = p_link_id;
  IF v_link IS NULL THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;
  IF NOT public.card_pode_editar(v_link.card_id) THEN
    RAISE EXCEPTION 'Sem permissão para remover este vínculo.';
  END IF;

  IF p_arquivar THEN
    UPDATE public.card_entity_links
      SET archived_at = now(), is_primary = false, situacao = 'arquivada', updated_by = auth.uid(), updated_at = now()
      WHERE id = p_link_id;
  ELSE
    DELETE FROM public.card_entity_links WHERE id = p_link_id;
  END IF;

  INSERT INTO public.kanban_extensao_log(card_id, extensao_codigo, entity_type, entity_id, acao, resultado, ator_id)
  VALUES (v_link.card_id, v_link.extensao_codigo, v_link.entity_type, v_link.entity_id,
          CASE WHEN p_arquivar THEN 'vinculo_arquivar' ELSE 'vinculo_remover' END, 'ok', auth.uid());

  INSERT INTO public.card_atividades(card_id, evento, detalhe, ator_id)
  VALUES (v_link.card_id, 'vinculo_removido',
          jsonb_build_object('entity_type', v_link.entity_type, 'entity_id', v_link.entity_id), auth.uid());
END;
$$;

-- 10. Definir vínculo principal
CREATE OR REPLACE FUNCTION public.card_entity_link_definir_principal(p_link_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_link record;
BEGIN
  SELECT * INTO v_link FROM public.card_entity_links WHERE id = p_link_id AND archived_at IS NULL;
  IF v_link IS NULL THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;
  IF NOT public.card_pode_editar(v_link.card_id) THEN
    RAISE EXCEPTION 'Sem permissão para alterar este vínculo.';
  END IF;
  UPDATE public.card_entity_links SET is_primary = false, updated_at = now()
    WHERE card_id = v_link.card_id AND is_primary AND archived_at IS NULL;
  UPDATE public.card_entity_links SET is_primary = true, updated_by = auth.uid(), updated_at = now()
    WHERE id = p_link_id;
  INSERT INTO public.kanban_extensao_log(card_id, extensao_codigo, entity_type, entity_id, acao, resultado, ator_id)
  VALUES (v_link.card_id, v_link.extensao_codigo, v_link.entity_type, v_link.entity_id, 'vinculo_principal', 'ok', auth.uid());
END;
$$;

-- 11. Reordenar
CREATE OR REPLACE FUNCTION public.card_entity_link_reordenar(p_link_id uuid, p_ordem integer)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_link record;
BEGIN
  SELECT * INTO v_link FROM public.card_entity_links WHERE id = p_link_id;
  IF v_link IS NULL THEN RAISE EXCEPTION 'Vínculo não encontrado.'; END IF;
  IF NOT public.card_pode_editar(v_link.card_id) THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;
  UPDATE public.card_entity_links SET display_order = p_ordem, updated_at = now(), updated_by = auth.uid()
    WHERE id = p_link_id;
END;
$$;

-- 12. Listar vínculos resolvidos (nome/situação vindos da fonte oficial)
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

-- 13. Cards vinculados a uma entidade (navegação inversa)
CREATE OR REPLACE FUNCTION public.cards_por_entidade(p_entity_type text, p_entity_id uuid)
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

-- 14. Verificação de integridade (vínculos órfãos)
CREATE OR REPLACE FUNCTION public.card_entity_links_verificar_integridade()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0;
BEGIN
  IF NOT public.is_current_player_gm() THEN
    RAISE EXCEPTION 'Somente GM pode executar a verificação de integridade.';
  END IF;
  WITH quebrados AS (
    SELECT l.id FROM public.card_entity_links l
    LEFT JOIN LATERAL public.kanban_entidade_info(l.entity_type, l.entity_id) i ON true
    WHERE l.archived_at IS NULL AND COALESCE(i.existe,false) = false
  )
  UPDATE public.card_entity_links SET situacao = 'quebrado', updated_at = now()
  WHERE id IN (SELECT id FROM quebrados) AND situacao <> 'quebrado';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.kanban_extensao_log(acao, resultado, ator_id, metadata)
  VALUES ('integridade_verificar','ok', auth.uid(), jsonb_build_object('quebrados', v_count));
  RETURN v_count;
END;
$$;

-- 15. Registrar execução de ação de extensão (auditoria genérica)
CREATE OR REPLACE FUNCTION public.kanban_extensao_registrar_acao(
  p_card_id uuid, p_extensao text, p_acao text,
  p_resultado text DEFAULT 'ok', p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.card_pode_editar(p_card_id) THEN
    RAISE EXCEPTION 'Sem permissão para executar ações neste card.';
  END IF;
  INSERT INTO public.kanban_extensao_log(card_id, extensao_codigo, acao, resultado, ator_id, metadata)
  VALUES (p_card_id, p_extensao, p_acao, COALESCE(p_resultado,'ok'), auth.uid(), COALESCE(p_metadata,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.card_entity_link_criar(uuid,text,text,uuid,text,boolean,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.card_entity_link_criar(uuid,text,text,uuid,text,boolean,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_entity_link_remover(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_entity_link_definir_principal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_entity_link_reordenar(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_entity_links_listar(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cards_por_entidade(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_entity_links_verificar_integridade() TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_extensao_registrar_acao(uuid,text,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kanban_entidade_info(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.card_pode_editar(uuid) TO authenticated;

-- 16. Migração de vínculos legados (obra_id / cronograma_item_id) — preserva o legado
INSERT INTO public.card_entity_links (card_id, extensao_codigo, entity_type, entity_id, relationship_type, is_primary, display_order, empresa_id, origem, created_at)
SELECT c.id, 'obra', 'obra', c.obra_id, 'contexto', false, 0, o.empresa_id, 'migracao_legado', now()
FROM public.cards c
JOIN public.obras o ON o.id = c.obra_id
WHERE c.obra_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.card_entity_links (card_id, extensao_codigo, entity_type, entity_id, relationship_type, is_primary, display_order, empresa_id, origem, created_at)
SELECT c.id, 'cronograma', 'cronograma_item', c.cronograma_item_id, 'atividade', false, 1, o.empresa_id, 'migracao_legado', now()
FROM public.cards c
JOIN public.cronograma_itens ci ON ci.id = c.cronograma_item_id
LEFT JOIN public.obras o ON o.id = ci.obra_id
WHERE c.cronograma_item_id IS NOT NULL
ON CONFLICT DO NOTHING;