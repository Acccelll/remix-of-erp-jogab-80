-- Harden internal authorization helpers
CREATE OR REPLACE FUNCTION public.current_has_setor(p_setor text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.user_setores us
      WHERE us.user_id = auth.uid()
        AND lower(us.setor) = lower(p_setor)
    );
$function$;

CREATE OR REPLACE FUNCTION public._require_gm()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Acesso negado: requer GM' USING ERRCODE = '42501';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._require_gm_or_financeiro()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.current_is_gm() OR public.current_has_setor('Financeiro')) THEN
    RAISE EXCEPTION 'Acesso negado: requer GM ou Financeiro' USING ERRCODE = '42501';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._require_obra_access(p_obra uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_obra IS NULL OR NOT public.user_em_obra(p_obra) THEN
    RAISE EXCEPTION 'Acesso negado à obra' USING ERRCODE = '42501';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._require_obra_edit(p_obra uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF p_obra IS NULL OR NOT public.user_pode_editar_obra(p_obra) THEN
    RAISE EXCEPTION 'Acesso negado para editar a obra' USING ERRCODE = '42501';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._require_any_setor_or_gm(VARIADIC p_setores text[])
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.current_is_gm() THEN
    RETURN;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.user_setores us
    WHERE us.user_id = auth.uid()
      AND lower(us.setor) = ANY (ARRAY(SELECT lower(s) FROM unnest(p_setores) AS s))
  ) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Acesso negado: setor não autorizado' USING ERRCODE = '42501';
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_card_access(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.current_is_gm()
    OR EXISTS (
      SELECT 1
      FROM public.card_setores cs
      JOIN public.user_setores us
        ON us.user_id = auth.uid()
       AND lower(us.setor) = lower(cs.setor)
      WHERE cs.card_id = p_card_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.cards c
      WHERE c.id = p_card_id
        AND c.obra_id IS NOT NULL
        AND public.user_em_obra(c.obra_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.card_membros cm
      WHERE cm.card_id = p_card_id
        AND cm.user_id = auth.uid()
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.current_has_setor(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._require_gm() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._require_gm_or_financeiro() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._require_obra_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._require_obra_edit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._require_any_setor_or_gm(VARIADIC text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_card_access(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_has_setor(text) TO service_role;
GRANT EXECUTE ON FUNCTION public._require_gm() TO service_role;
GRANT EXECUTE ON FUNCTION public._require_gm_or_financeiro() TO service_role;
GRANT EXECUTE ON FUNCTION public._require_obra_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._require_obra_edit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public._require_any_setor_or_gm(VARIADIC text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_card_access(uuid) TO service_role;

-- Correct policies that were scoped to public instead of authenticated
DROP POLICY IF EXISTS "financeiro_lancamentos_select_fin" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_lancamentos_select_fin"
ON public.financeiro_lancamentos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR (obra_id IS NOT NULL AND public.user_em_obra(obra_id))
);

DROP POLICY IF EXISTS "rdo read" ON public.rdo;
CREATE POLICY "rdo read"
ON public.rdo
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cronograma_itens select" ON public.cronograma_itens;
CREATE POLICY "cronograma_itens select"
ON public.cronograma_itens
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "restricoes_select_auth" ON public.restricoes;
CREATE POLICY "restricoes_select_auth"
ON public.restricoes
FOR SELECT
TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "colaboradores select por rh da obra ou gm" ON public.colaboradores;
CREATE POLICY "colaboradores select por rh autorizado da obra ou gm"
ON public.colaboradores
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.user_pode_editar_obra(obra_atual_id::uuid)
  )
);

DROP POLICY IF EXISTS "colaboradores write por rh da obra ou gm" ON public.colaboradores;
CREATE POLICY "colaboradores write por rh autorizado da obra ou gm"
ON public.colaboradores
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.user_pode_editar_obra(obra_atual_id::uuid)
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.user_pode_editar_obra(obra_atual_id::uuid)
  )
);

-- Harden exposed RPCs with explicit authorization checks
CREATE OR REPLACE FUNCTION public.board_atividades_recentes(p_board_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, card_id uuid, evento text, ator_nome text, created_at timestamp with time zone, detalhe jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = p_board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_em_obra(b.obra_id))
        OR (b.tipo = 'custom' AND (b.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.board_membros bm WHERE bm.board_id = p_board_id AND bm.user_id = auth.uid()
        )))
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
$function$;

CREATE OR REPLACE FUNCTION public.board_items_resumo(p_board_id uuid)
RETURNS TABLE(card_id uuid, lista_id uuid, posicao integer, id uuid, numero bigint, titulo text, obra_id uuid, capa_cor text, capa_url text, prazo date, responsavel_id uuid, responsavel_login text, setores text[], labels jsonb, checklist_total integer, checklist_concluido integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = p_board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_em_obra(b.obra_id))
        OR (b.tipo = 'custom' AND (b.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.board_membros bm WHERE bm.board_id = p_board_id AND bm.user_id = auth.uid()
        )))
      )
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao quadro' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT cbp.card_id, cbp.lista_id, cbp.posicao, c.id, c.numero, c.titulo, c.obra_id,
           c.capa_cor, c.capa_url, c.prazo, c.responsavel_id, p.login AS responsavel_login
    FROM public.card_board_posicao cbp
    JOIN public.cards c ON c.id = cbp.card_id
    LEFT JOIN public.profiles p ON p.id = c.responsavel_id
    WHERE cbp.board_id = p_board_id
      AND cbp.arquivada = false
      AND (public.current_is_gm() OR public.has_card_access(c.id))
  ), setores AS (
    SELECT cs.card_id, array_agg(cs.setor ORDER BY cs.setor) AS setores
    FROM public.card_setores cs JOIN base b ON b.card_id = cs.card_id
    GROUP BY cs.card_id
  ), labels AS (
    SELECT cl.card_id, jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome, 'cor', l.cor) ORDER BY l.nome) AS labels
    FROM public.card_label_links cl
    JOIN public.card_labels l ON l.id = cl.label_id
    JOIN base b ON b.card_id = cl.card_id
    GROUP BY cl.card_id
  ), checklist AS (
    SELECT ci.card_id, count(*)::integer AS total, count(*) FILTER (WHERE ci.concluido)::integer AS concluido
    FROM public.card_checklist_itens ci JOIN base b ON b.card_id = ci.card_id
    GROUP BY ci.card_id
  )
  SELECT b.card_id, b.lista_id, b.posicao, b.id, b.numero, b.titulo, b.obra_id, b.capa_cor, b.capa_url,
         b.prazo, b.responsavel_id, b.responsavel_login, coalesce(s.setores, ARRAY[]::text[]),
         coalesce(l.labels, '[]'::jsonb), coalesce(ch.total, 0), coalesce(ch.concluido, 0)
  FROM base b
  LEFT JOIN setores s ON s.card_id = b.card_id
  LEFT JOIN labels l ON l.card_id = b.card_id
  LEFT JOIN checklist ch ON ch.card_id = b.card_id
  ORDER BY b.posicao;
END;
$function$;

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
    OR (v_board.tipo = 'obra' AND v_board.obra_id IS NOT NULL AND public.user_pode_editar_obra(v_board.obra_id))
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
  VALUES ('generico', v_titulo, 'aberto', v_board.obra_id, coalesce(nullif(p_criado_por, ''), 'sistema'))
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

CREATE OR REPLACE FUNCTION public.is_flag_enabled(_obra_id uuid, _flag_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR _obra_id IS NULL OR public.user_em_obra(_obra_id) THEN
      COALESCE(
        (SELECT enabled FROM public.feature_flags WHERE flag_key = _flag_key AND obra_id = _obra_id LIMIT 1),
        (SELECT enabled FROM public.feature_flags WHERE flag_key = _flag_key AND obra_id IS NULL LIMIT 1),
        false
      )
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_medicao_atomica(p_obra_id uuid, p_numero text, p_data_inicio date, p_data_corte date, p_observacoes text, p_valor_total numeric, p_itens jsonb, p_bms_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_baseline_id uuid;
  v_medicao_id  uuid;
begin
  perform public._require_obra_edit(p_obra_id);
  perform public._require_any_setor_or_gm('Financeiro');

  select id into v_baseline_id
  from public.cronograma_baselines
  where obra_id = p_obra_id
  order by versao desc
  limit 1;

  insert into public.medicoes (obra_id, numero, data_inicio, data_corte, valor, status, observacoes, baseline_id)
  values (p_obra_id, p_numero, p_data_inicio, p_data_corte, coalesce(p_valor_total, 0), 'rascunho', nullif(p_observacoes, ''), v_baseline_id)
  returning id into v_medicao_id;

  if p_itens is not null and jsonb_array_length(p_itens) > 0 then
    insert into public.itens_medicao (medicao_id, cronograma_item_id, percentual_anterior, percentual_atual, valor_anterior, valor_atual)
    select v_medicao_id, ci.id,
      coalesce((it->>'percentual_anterior')::numeric, 0),
      coalesce((it->>'percentual_atual')::numeric, 0),
      coalesce((it->>'valor_anterior')::numeric, 0),
      coalesce((it->>'valor_atual')::numeric, 0)
    from jsonb_array_elements(p_itens) as it
    join public.cronograma_itens ci on ci.id = (it->>'cronograma_item_id')::uuid and ci.obra_id = p_obra_id
    where (it->>'cronograma_item_id') is not null;

    update public.cronograma_itens ci
    set percentual_realizado = sub.pct_atual
    from (
      select (it->>'cronograma_item_id')::uuid as item_id,
             coalesce((it->>'percentual_atual')::numeric, 0) as pct_atual
      from jsonb_array_elements(p_itens) as it
      where (it->>'cronograma_item_id') is not null
    ) sub
    where ci.id = sub.item_id and ci.obra_id = p_obra_id;
  end if;

  if p_bms_id is not null then
    update public.bms_previstas
    set status = 'aberta', medicao_id = v_medicao_id
    where id = p_bms_id and obra_id = p_obra_id;
  end if;

  return v_medicao_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fechar_bms_atomica(p_bms_id uuid, p_valor_realizado numeric, p_futuras jsonb, p_registros jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_obra_id uuid;
  v_origem_numero integer;
begin
  select obra_id, numero into v_obra_id, v_origem_numero
  from public.bms_previstas
  where id = p_bms_id
  for update;

  if v_obra_id is null then
    raise exception 'BMS % não encontrada', p_bms_id;
  end if;

  perform public._require_obra_edit(v_obra_id);
  perform public._require_any_setor_or_gm('Financeiro');

  update public.bms_previstas
  set status = 'fechada', valor_previsto_dinamico = coalesce(p_valor_realizado, valor_previsto_dinamico)
  where id = p_bms_id and obra_id = v_obra_id;

  if p_futuras is not null and jsonb_array_length(p_futuras) > 0 then
    update public.bms_previstas bp
    set valor_previsto_dinamico = sub.valor_novo
    from (
      select (f->>'id')::uuid as id, (f->>'valor_novo')::numeric as valor_novo
      from jsonb_array_elements(p_futuras) as f
      where (f->>'id') is not null
    ) sub
    where bp.id = sub.id
      and bp.obra_id = v_obra_id
      and abs(bp.valor_previsto_dinamico - sub.valor_novo) >= 0.005;
  end if;

  delete from public.bms_redistribuicao
  where obra_id = v_obra_id and bms_origem_numero = v_origem_numero;

  if p_registros is not null and jsonb_array_length(p_registros) > 0 then
    insert into public.bms_redistribuicao (obra_id, bms_origem_numero, bms_destino_numero, cronograma_item_id, descricao_item, valor_atrasado, valor_absorvido, motivo)
    select v_obra_id, v_origem_numero, (r->>'bms_destino_numero')::integer,
           nullif(r->>'cronograma_item_id', '')::uuid, r->>'descricao_item',
           coalesce((r->>'valor_atrasado')::numeric, 0), coalesce((r->>'valor_absorvido')::numeric, 0), r->>'motivo'
    from jsonb_array_elements(p_registros) as r;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.excluir_nf_atomica(p_nf_id uuid, p_valor_contrato numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_obra_id uuid;
begin
  select obra_id into v_obra_id from public.notas_fiscais where id = p_nf_id;
  if v_obra_id is null then
    raise exception 'NF % não encontrada', p_nf_id;
  end if;

  perform public._require_obra_edit(v_obra_id);
  perform public._require_any_setor_or_gm('Financeiro');

  update public.bms_previstas set nota_fiscal_id = null, status = 'prevista'
  where nota_fiscal_id = p_nf_id and obra_id = v_obra_id;

  delete from public.recebimentos
  where nota_fiscal_id = p_nf_id and obra_id = v_obra_id and data_recebimento is null;

  delete from public.notas_fiscais where id = p_nf_id and obra_id = v_obra_id;

  perform public.fn_recalcular_previsao_nf(v_obra_id, p_valor_contrato);
  return jsonb_build_object('obra_id', v_obra_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recalcular_previsao_nf(p_obra_id uuid, p_valor_contrato numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_faturado NUMERIC := 0;
  v_fixo NUMERIC := 0;
  v_saldo NUMERIC := 0;
  v_soma_prev NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  PERFORM public._require_obra_edit(p_obra_id);
  PERFORM public._require_any_setor_or_gm('Financeiro');

  SELECT COALESCE(SUM(valor),0) INTO v_faturado
    FROM public.notas_fiscais
   WHERE obra_id = p_obra_id AND COALESCE(status::text,'') <> 'cancelada';
  SELECT COALESCE(SUM(valor_previsto_dinamico),0) INTO v_fixo
    FROM public.bms_previstas
   WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista'
     AND (origem = 'manual' OR medicao_id IS NOT NULL);
  v_saldo := COALESCE(p_valor_contrato,0) - v_faturado - v_fixo;
  SELECT COALESCE(SUM(valor_previsto_dinamico),0), COUNT(*) INTO v_soma_prev, v_count
    FROM public.bms_previstas
   WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista'
     AND origem <> 'manual' AND medicao_id IS NULL;
  IF v_count = 0 THEN RETURN; END IF;
  IF v_soma_prev > 0 THEN
    UPDATE public.bms_previstas
       SET valor_previsto_dinamico = ROUND(valor_previsto_dinamico * v_saldo / v_soma_prev, 2)
     WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista'
       AND origem <> 'manual' AND medicao_id IS NULL;
  ELSE
    UPDATE public.bms_previstas
       SET valor_previsto_dinamico = ROUND(v_saldo / v_count, 2)
     WHERE obra_id = p_obra_id AND COALESCE(status,'') = 'prevista'
       AND origem <> 'manual' AND medicao_id IS NULL;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_recalcular_apos_faturamento(p_obra_id uuid, p_nf_id uuid, p_valor_contrato numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_faturado numeric := 0;
  v_delta numeric := 0;
  v_atualizadas integer := 0;
BEGIN
  PERFORM public._require_obra_edit(p_obra_id);
  PERFORM public._require_any_setor_or_gm('Financeiro');

  SELECT COALESCE(valor,0) INTO v_valor_faturado
  FROM public.notas_fiscais WHERE id = p_nf_id AND obra_id = p_obra_id;

  PERFORM public.fn_recalcular_previsao_nf(p_obra_id, p_valor_contrato);
  GET DIAGNOSTICS v_atualizadas = ROW_COUNT;
  RETURN jsonb_build_object('delta', v_delta, 'futuras_atualizadas', v_atualizadas, 'valor_faturado', v_valor_faturado);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_reverter_faturamento_bms(p_obra_id uuid, p_bms_id uuid, p_valor_contrato numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._require_obra_edit(p_obra_id);
  PERFORM public._require_any_setor_or_gm('Financeiro');
  PERFORM public.fn_recalcular_previsao_nf(p_obra_id, p_valor_contrato);
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_nf_atomica(p_nf_id uuid, p_payload jsonb, p_data_prevista date, p_valor_liquido numeric, p_bms_prevista_id uuid, p_medicao_id_fallback uuid, p_valor_contrato numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_nf_id uuid;
  v_obra_id uuid;
  v_obra_existente uuid;
  v_bms_atual_id uuid;
begin
  v_obra_id := (p_payload->>'obra_id')::uuid;
  if v_obra_id is null then
    raise exception 'payload sem obra_id';
  end if;

  perform public._require_obra_edit(v_obra_id);
  perform public._require_any_setor_or_gm('Financeiro');

  if p_nf_id is not null then
    select obra_id into v_obra_existente from public.notas_fiscais where id = p_nf_id;
    if v_obra_existente is null then
      raise exception 'NF % não encontrada', p_nf_id;
    end if;
    if v_obra_existente is distinct from v_obra_id then
      raise exception 'Não é permitido mover NF entre obras' USING ERRCODE = '42501';
    end if;
  end if;

  if p_nf_id is null then
    insert into public.notas_fiscais
    select * from jsonb_populate_record(null::public.notas_fiscais, p_payload)
    returning id into v_nf_id;

    insert into public.recebimentos (obra_id, nota_fiscal_id, data_prevista, valor_previsto, valor_previsto_inicial, status, origem, congelado)
    values (v_obra_id, v_nf_id, p_data_prevista, p_valor_liquido, p_valor_liquido, 'a_receber', 'nf', true);
  else
    v_nf_id := p_nf_id;

    update public.notas_fiscais nf
    set medicao_id = p.medicao_id,
        numero = p.numero,
        data_emissao = p.data_emissao,
        competencia = p.competencia,
        valor = coalesce(p.valor, nf.valor),
        valor_servicos = p.valor_servicos,
        valor_material = p.valor_material,
        percentual_material = p.percentual_material,
        inss_retido = p.inss_retido,
        iss_retido = p.iss_retido,
        retencao_cbs = p.retencao_cbs,
        retencao_ibs = p.retencao_ibs,
        outras_retencoes = p.outras_retencoes,
        valor_liquido = p.valor_liquido,
        codigo_cno = p.codigo_cno,
        codigo_art = p.codigo_art,
        codigo_verificacao = p.codigo_verificacao,
        data_vencimento = p.data_vencimento,
        pdf_url = coalesce(p.pdf_url, nf.pdf_url)
    from jsonb_populate_record(null::public.notas_fiscais, p_payload) p
    where nf.id = p_nf_id and nf.obra_id = v_obra_id;

    update public.recebimentos
    set valor_previsto = p_valor_liquido,
        valor_previsto_inicial = p_valor_liquido,
        data_prevista = p_data_prevista
    where nota_fiscal_id = p_nf_id and obra_id = v_obra_id and data_recebimento is null;
  end if;

  select id into v_bms_atual_id
  from public.bms_previstas
  where nota_fiscal_id = v_nf_id and obra_id = v_obra_id
  limit 1;

  if v_bms_atual_id is not null and v_bms_atual_id is distinct from p_bms_prevista_id then
    update public.bms_previstas set nota_fiscal_id = null, status = 'prevista'
    where id = v_bms_atual_id and obra_id = v_obra_id;
  end if;

  if p_bms_prevista_id is not null and (v_bms_atual_id is null or v_bms_atual_id is distinct from p_bms_prevista_id) then
    update public.bms_previstas set nota_fiscal_id = v_nf_id, status = 'faturada'
    where id = p_bms_prevista_id and obra_id = v_obra_id;
  elsif p_nf_id is null and p_bms_prevista_id is null and p_medicao_id_fallback is not null then
    update public.bms_previstas set nota_fiscal_id = v_nf_id, status = 'faturada'
    where obra_id = v_obra_id and medicao_id = p_medicao_id_fallback;
  end if;

  perform public.fn_recalcular_previsao_nf(v_obra_id, p_valor_contrato);
  return jsonb_build_object('nf_id', v_nf_id, 'obra_id', v_obra_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_oc_aprovar(p_oc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_obra_id uuid;
  v_valor numeric;
  v_status_aprov text;
  v_papeis text[];
  v_papel text;
  v_atendidos text[];
  v_aprovacoes jsonb;
  v_completo boolean := false;
BEGIN
  SELECT obra_id, valor_total, status_aprovacao, aprovacoes
    INTO v_obra_id, v_valor, v_status_aprov, v_aprovacoes
    FROM public.ordens_compra
   WHERE id = p_oc_id
   FOR UPDATE;

  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'OC não encontrada';
  END IF;

  PERFORM public._require_obra_access(v_obra_id);

  IF v_status_aprov = 'aprovada' THEN
    RAISE EXCEPTION 'OC já aprovada';
  END IF;

  SELECT array_agg(papel_aprovador ORDER BY ordem) INTO v_papeis
  FROM public.alcadas_aprovacao
  WHERE valor_min <= v_valor AND (valor_max IS NULL OR valor_max >= v_valor);

  IF v_papeis IS NULL OR array_length(v_papeis,1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma alçada configurada cobre o valor %', v_valor;
  END IF;

  SELECT array_agg(elem->>'papel') INTO v_atendidos
  FROM jsonb_array_elements(COALESCE(v_aprovacoes, '[]'::jsonb)) elem;
  v_atendidos := COALESCE(v_atendidos, '{}');

  v_papel := NULL;
  FOREACH v_papel IN ARRAY v_papeis LOOP
    IF NOT (v_papel = ANY(v_atendidos)) THEN
      EXIT;
    END IF;
    v_papel := NULL;
  END LOOP;

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Todas as alçadas já foram aprovadas';
  END IF;

  IF NOT (public.current_is_gm() OR public.current_has_setor(v_papel)) THEN
    RAISE EXCEPTION 'Sem permissão: aprovação requer papel %', v_papel;
  END IF;

  v_aprovacoes := COALESCE(v_aprovacoes, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('papel', v_papel, 'user_id', auth.uid(), 'em', now()));

  v_completo := (
    SELECT bool_and(p = ANY(ARRAY(SELECT jsonb_array_elements(v_aprovacoes)->>'papel')))
    FROM unnest(v_papeis) p
  );

  UPDATE public.ordens_compra
     SET aprovacoes = v_aprovacoes,
         status_aprovacao = CASE WHEN v_completo THEN 'aprovada' ELSE 'pendente' END,
         aprovado_por = CASE WHEN v_completo THEN auth.uid() ELSE aprovado_por END,
         aprovado_em = CASE WHEN v_completo THEN now() ELSE aprovado_em END,
         updated_at = now()
   WHERE id = p_oc_id AND obra_id = v_obra_id;

  RETURN jsonb_build_object('aprovada', v_completo, 'papel_aprovado', v_papel, 'aprovacoes', v_aprovacoes, 'papeis_exigidos', v_papeis);
END;
$function$;

CREATE OR REPLACE FUNCTION public.emitir_oc_atomico(p_oc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oc public.ordens_compra%ROWTYPE;
  v_qtd_itens integer;
  v_req_ids uuid[];
BEGIN
  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC % não encontrada', p_oc_id USING ERRCODE='P0002'; END IF;

  PERFORM public._require_obra_edit(v_oc.obra_id);
  PERFORM public._require_any_setor_or_gm('Compras');

  IF v_oc.status <> 'rascunho' THEN
    RAISE EXCEPTION 'OC já está em status %, não pode ser emitida', v_oc.status USING ERRCODE='P0001';
  END IF;
  IF v_oc.status_aprovacao <> 'aprovada' THEN
    RAISE EXCEPTION 'OC precisa estar aprovada antes de ser emitida' USING ERRCODE='P0001';
  END IF;
  SELECT count(*) INTO v_qtd_itens FROM public.ordem_compra_itens WHERE ordem_compra_id = p_oc_id;
  IF v_qtd_itens = 0 THEN RAISE EXCEPTION 'OC sem itens não pode ser emitida' USING ERRCODE='P0001'; END IF;
  UPDATE public.ordens_compra SET status='emitida', emitida_em=COALESCE(emitida_em, now()) WHERE id = p_oc_id AND obra_id = v_oc.obra_id;
  SELECT array_agg(DISTINCT requisicao_id) INTO v_req_ids
    FROM public.ordem_compra_itens WHERE ordem_compra_id = p_oc_id AND requisicao_id IS NOT NULL;
  IF v_req_ids IS NOT NULL AND array_length(v_req_ids,1) > 0 THEN
    UPDATE public.requisicoes SET status='atendida' WHERE id = ANY(v_req_ids) AND obra_id = v_oc.obra_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'oc_id', p_oc_id, 'qtd_itens', v_qtd_itens, 'requisicoes', COALESCE(array_length(v_req_ids,1), 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_atomico(p_oc_id uuid, p_nota_fiscal text, p_data date, p_observacao text, p_itens jsonb, p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_oc public.ordens_compra%ROWTYPE;
  v_rec_id uuid;
  v_item record; v_entry record;
  v_recebido numeric; v_pedido numeric;
  v_total_qtd numeric := 0;
  v_tudo_ok boolean; v_novo_st text;
BEGIN
  IF p_oc_id IS NULL OR p_owner_id IS NULL THEN
    RAISE EXCEPTION 'oc_id e owner_id são obrigatórios' USING ERRCODE='P0001';
  END IF;
  IF auth.role() <> 'service_role' AND p_owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Responsável incompatível com usuário autenticado' USING ERRCODE='42501';
  END IF;
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC % não encontrada', p_oc_id USING ERRCODE='P0002'; END IF;

  PERFORM public._require_obra_edit(v_oc.obra_id);
  PERFORM public._require_any_setor_or_gm('Compras', 'Produção', 'Producao', 'Engenharia');

  IF v_oc.status NOT IN ('emitida','recebida_parcial') THEN
    RAISE EXCEPTION 'OC em status % não aceita recebimento', v_oc.status USING ERRCODE='P0001';
  END IF;

  FOR v_entry IN
    SELECT (e->>'ordem_compra_item_id')::uuid AS item_id, (e->>'quantidade')::numeric AS qtd
    FROM jsonb_array_elements(p_itens) AS e
  LOOP
    IF v_entry.qtd IS NULL OR v_entry.qtd <= 0 THEN CONTINUE; END IF;
    SELECT quantidade INTO v_pedido FROM public.ordem_compra_itens
    WHERE id = v_entry.item_id AND ordem_compra_id = p_oc_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % não pertence à OC', v_entry.item_id USING ERRCODE='P0001';
    END IF;
    SELECT COALESCE(SUM(quantidade_recebida),0) INTO v_recebido
    FROM public.recebimento_itens WHERE ordem_compra_item_id = v_entry.item_id;
    IF v_entry.qtd > (v_pedido - v_recebido + 1e-9) THEN
      RAISE EXCEPTION 'Quantidade % excede saldo do item % (pedido=%, recebido=%)', v_entry.qtd, v_entry.item_id, v_pedido, v_recebido USING ERRCODE='P0001';
    END IF;
    v_total_qtd := v_total_qtd + v_entry.qtd;
  END LOOP;
  IF v_total_qtd = 0 THEN RAISE EXCEPTION 'Nenhuma quantidade > 0 informada' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.recebimento_materiais (ordem_compra_id, nota_fiscal, data_recebimento, observacao, owner_id)
  VALUES (p_oc_id, NULLIF(p_nota_fiscal,''), COALESCE(p_data, CURRENT_DATE), NULLIF(p_observacao,''), p_owner_id)
  RETURNING id INTO v_rec_id;

  INSERT INTO public.recebimento_itens (recebimento_id, ordem_compra_item_id, quantidade_recebida)
  SELECT v_rec_id, (e->>'ordem_compra_item_id')::uuid, (e->>'quantidade')::numeric
  FROM jsonb_array_elements(p_itens) AS e WHERE (e->>'quantidade')::numeric > 0;

  FOR v_item IN
    SELECT oci.insumo_id, (e->>'quantidade')::numeric AS qtd
    FROM jsonb_array_elements(p_itens) AS e
    JOIN public.ordem_compra_itens oci ON oci.id = (e->>'ordem_compra_item_id')::uuid
    WHERE (e->>'quantidade')::numeric > 0 AND oci.insumo_id IS NOT NULL AND oci.ordem_compra_id = p_oc_id
  LOOP
    INSERT INTO public.estoque_movimentacoes (local, insumo_id, tipo, quantidade, origem, observacao, owner_id)
    VALUES (v_oc.obra_id, v_item.insumo_id, 'entrada', v_item.qtd, 'recebimento:'||v_rec_id,
            CASE WHEN NULLIF(p_nota_fiscal,'') IS NOT NULL THEN 'NF '||p_nota_fiscal END, p_owner_id);
    INSERT INTO public.estoque_saldos (local, insumo_id, saldo)
    VALUES (v_oc.obra_id, v_item.insumo_id, v_item.qtd)
    ON CONFLICT (local, insumo_id) DO UPDATE SET saldo = public.estoque_saldos.saldo + EXCLUDED.saldo;
  END LOOP;

  SELECT bool_and(COALESCE(rec.qtd,0) >= oci.quantidade - 1e-9) INTO v_tudo_ok
  FROM public.ordem_compra_itens oci
  LEFT JOIN (
    SELECT ordem_compra_item_id, SUM(quantidade_recebida) AS qtd
    FROM public.recebimento_itens GROUP BY ordem_compra_item_id
  ) rec ON rec.ordem_compra_item_id = oci.id
  WHERE oci.ordem_compra_id = p_oc_id;
  v_novo_st := CASE WHEN v_tudo_ok THEN 'recebida' ELSE 'recebida_parcial' END;
  UPDATE public.ordens_compra SET status = v_novo_st WHERE id = p_oc_id AND obra_id = v_oc.obra_id;

  RETURN jsonb_build_object('ok', true, 'recebimento_id', v_rec_id, 'oc_id', p_oc_id, 'novo_status', v_novo_st, 'total_quantidade', v_total_qtd);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_atualizar_cpm(p_obra_id uuid, p_resultados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._require_obra_edit(p_obra_id);

  UPDATE public.cronograma_itens ci
     SET folga_dias = r.folga_dias,
         critico = r.critico,
         folga_livre_dias = r.folga_livre_dias,
         fanout_sucessoras = COALESCE(r.fanout, 0),
         importancia_score = r.score,
         importancia_classe = r.classe
    FROM jsonb_to_recordset(p_resultados) AS r(
           id uuid, folga_dias int, critico boolean, folga_livre_dias int, fanout int, score numeric, classe text)
   WHERE ci.id = r.id AND ci.obra_id = p_obra_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_estoque_transferir(p_insumo uuid, p_origem text, p_destino text, p_quantidade numeric, p_observacao text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo_origem numeric;
  v_ref uuid := gen_random_uuid();
  v_origem_tag text;
BEGIN
  PERFORM public._require_any_setor_or_gm('Compras');
  IF p_origem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public._require_obra_edit(p_origem::uuid);
  END IF;
  IF p_destino ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public._require_obra_edit(p_destino::uuid);
  END IF;
  IF p_insumo IS NULL THEN RAISE EXCEPTION 'Insumo obrigatório'; END IF;
  IF p_origem IS NULL OR p_destino IS NULL THEN RAISE EXCEPTION 'Origem e destino obrigatórios'; END IF;
  IF p_origem = p_destino THEN RAISE EXCEPTION 'Origem e destino devem ser diferentes'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade deve ser maior que zero'; END IF;

  SELECT saldo INTO v_saldo_origem
  FROM public.estoque_saldos
  WHERE local = p_origem AND insumo_id = p_insumo
  FOR UPDATE;

  IF v_saldo_origem IS NULL OR v_saldo_origem < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no local de origem (disponível: %)', COALESCE(v_saldo_origem, 0);
  END IF;

  v_origem_tag := 'transferencia:' || v_ref::text;
  INSERT INTO public.estoque_movimentacoes(local, insumo_id, tipo, quantidade, origem, observacao)
  VALUES (p_origem, p_insumo, 'saida', p_quantidade, v_origem_tag, p_observacao),
         (p_destino, p_insumo, 'entrada', p_quantidade, v_origem_tag, p_observacao);

  UPDATE public.estoque_saldos SET saldo = saldo - p_quantidade, updated_at = now()
  WHERE local = p_origem AND insumo_id = p_insumo;

  INSERT INTO public.estoque_saldos(local, insumo_id, saldo)
  VALUES (p_destino, p_insumo, p_quantidade)
  ON CONFLICT (local, insumo_id) DO UPDATE
    SET saldo = public.estoque_saldos.saldo + EXCLUDED.saldo, updated_at = now();

  RETURN jsonb_build_object('ref', v_ref, 'quantidade', p_quantidade);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_inspecao_materializar_pendentes(p_ate date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_a RECORD;
  v_count INT := 0;
  v_existe UUID;
  v_prox DATE;
BEGIN
  IF auth.role() <> 'service_role' THEN
    PERFORM public._require_any_setor_or_gm('Qualidade', 'Engenharia', 'Segurança', 'Seguranca');
  END IF;

  FOR v_a IN
    SELECT * FROM public.inspecao_agendas
    WHERE ativa = true
      AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
      AND (
        auth.role() = 'service_role'
        OR public.current_is_gm()
        OR (public.user_pode_editar_obra(obra_id) AND (
          public.current_has_setor('Qualidade') OR public.current_has_setor('Engenharia') OR public.current_has_setor('Segurança') OR public.current_has_setor('Seguranca')
        ))
      )
  LOOP
    v_prox := COALESCE(v_a.proxima_data, public.fn_inspecao_proxima_data(v_a.frequencia, v_a.dias_semana, v_a.dia_mes, v_a.data_inicio, GREATEST(v_a.data_inicio, CURRENT_DATE)));

    WHILE v_prox IS NOT NULL AND v_prox <= p_ate LOOP
      SELECT id INTO v_existe
      FROM public.inspecoes
      WHERE modelo_id = v_a.modelo_id AND obra_id = v_a.obra_id AND data_planejada = v_prox AND COALESCE(local,'') = COALESCE(v_a.local,'')
      LIMIT 1;

      IF v_existe IS NULL THEN
        INSERT INTO public.inspecoes (modelo_id, obra_id, local, responsavel_id, data_planejada, status, created_by)
        VALUES (v_a.modelo_id, v_a.obra_id, v_a.local, v_a.responsavel_id, v_prox, 'rascunho', COALESCE(v_a.created_by, auth.uid()));
        v_count := v_count + 1;
      END IF;

      v_prox := public.fn_inspecao_proxima_data(v_a.frequencia, v_a.dias_semana, v_a.dia_mes, v_a.data_inicio, (v_prox + 1)::DATE);
    END LOOP;

    UPDATE public.inspecao_agendas SET proxima_data = v_prox, ultima_geracao_em = now()
    WHERE id = v_a.id;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_nc_notificar_prazos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_rec record;
  v_obra_nome text;
  v_dias integer;
  v_texto text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    PERFORM public._require_any_setor_or_gm('Qualidade', 'Engenharia', 'Segurança', 'Seguranca');
  END IF;

  FOR v_rec IN
    SELECT n.id, n.codigo, n.titulo, n.obra_id, n.quem, n.quando_planejado
    FROM public.nao_conformidades n
    WHERE n.quem IS NOT NULL
      AND n.quando_planejado IS NOT NULL
      AND n.status NOT IN ('resolvida','cancelada')
      AND n.quando_planejado <= (current_date + interval '2 days')
      AND (
        auth.role() = 'service_role'
        OR public.current_is_gm()
        OR (public.user_em_obra(n.obra_id) AND (
          n.created_by = auth.uid() OR n.quem = auth.uid()
          OR public.current_has_setor('Qualidade') OR public.current_has_setor('Engenharia') OR public.current_has_setor('Segurança') OR public.current_has_setor('Seguranca')
        ))
      )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notificacoes
      WHERE user_id = v_rec.quem AND tipo = 'nc_prazo' AND created_at::date = current_date AND texto LIKE '%[NC:' || v_rec.id::text || ']%'
    ) THEN
      CONTINUE;
    END IF;

    SELECT nome INTO v_obra_nome FROM public.obras WHERE id = v_rec.obra_id;
    v_dias := v_rec.quando_planejado - current_date;
    v_texto := format(
      '%s NC %s — %s%s [NC:%s]',
      CASE WHEN v_dias < 0 THEN format('Prazo VENCIDO há %s dia(s):', abs(v_dias)) WHEN v_dias = 0 THEN 'Prazo vence HOJE:' ELSE format('Prazo em %s dia(s):', v_dias) END,
      coalesce(v_rec.codigo, ''), v_rec.titulo,
      CASE WHEN v_obra_nome IS NOT NULL THEN ' — ' || v_obra_nome ELSE '' END,
      v_rec.id
    );

    INSERT INTO public.notificacoes (user_id, tipo, card_id, texto, lida)
    VALUES (v_rec.quem, 'nc_prazo', NULL, v_texto, false);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rdo_upsert_from_checklist(p_obra_id uuid, p_data date, p_checklist_codigo text, p_clima_manha text, p_clima_tarde text, p_clima_noite text, p_trabalhavel_manha boolean, p_trabalhavel_tarde boolean, p_trabalhavel_noite boolean, p_observacoes text, p_atividades jsonb, p_efetivo jsonb, p_ocorrencias jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rdo_id uuid;
  v_item jsonb;
BEGIN
  PERFORM public._require_obra_edit(p_obra_id);
  PERFORM public._require_any_setor_or_gm('Engenharia', 'Produção', 'Producao');

  INSERT INTO public.rdo (obra_id, data, clima_manha, clima_tarde, clima_noite, trabalhavel_manha, trabalhavel_tarde, trabalhavel_noite, observacoes, status, origem, checklist_codigo)
  VALUES (p_obra_id, p_data, p_clima_manha, p_clima_tarde, p_clima_noite, p_trabalhavel_manha, p_trabalhavel_tarde, p_trabalhavel_noite, COALESCE(p_observacoes,''), 'concluido', 'checklist_facil', p_checklist_codigo)
  ON CONFLICT (obra_id, data) DO UPDATE SET
    clima_manha = EXCLUDED.clima_manha,
    clima_tarde = EXCLUDED.clima_tarde,
    clima_noite = EXCLUDED.clima_noite,
    trabalhavel_manha = EXCLUDED.trabalhavel_manha,
    trabalhavel_tarde = EXCLUDED.trabalhavel_tarde,
    trabalhavel_noite = EXCLUDED.trabalhavel_noite,
    observacoes = EXCLUDED.observacoes,
    status = EXCLUDED.status,
    origem = EXCLUDED.origem,
    checklist_codigo = EXCLUDED.checklist_codigo,
    updated_at = now()
  RETURNING id INTO v_rdo_id;

  DELETE FROM public.rdo_atividades WHERE rdo_id = v_rdo_id;
  DELETE FROM public.rdo_efetivo WHERE rdo_id = v_rdo_id;
  DELETE FROM public.rdo_ocorrencias WHERE rdo_id = v_rdo_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_atividades,'[]'::jsonb)) LOOP
    INSERT INTO public.rdo_atividades (rdo_id, descricao, quantidade_dia, quantidade_acumulada)
    VALUES (v_rdo_id, COALESCE(v_item->>'descricao',''), NULLIF(v_item->>'quantidade_dia','')::numeric, NULLIF(v_item->>'quantidade_acumulada','')::numeric);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_efetivo,'[]'::jsonb)) LOOP
    INSERT INTO public.rdo_efetivo (rdo_id, tipo, nome_livre, funcao_livre, entrada, saida, quantidade, presente)
    VALUES (v_rdo_id, COALESCE(v_item->>'tipo','proprio'), v_item->>'nome_livre', v_item->>'funcao_livre', v_item->>'entrada', v_item->>'saida', 1, true);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_ocorrencias,'[]'::jsonb)) LOOP
    INSERT INTO public.rdo_ocorrencias (rdo_id, tipo, descricao)
    VALUES (v_rdo_id, COALESCE(v_item->>'tipo','ocorrencia'), COALESCE(v_item->>'descricao',''));
  END LOOP;

  RETURN v_rdo_id;
END;
$function$;