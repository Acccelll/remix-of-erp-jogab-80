
-- Adiciona guards de autorização nas 4 RPCs SECURITY DEFINER whitelisted.
-- Cada uma passa a exigir vínculo do usuário com a obra (ou GM), ademais do bypass de service_role.

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
  if auth.role() <> 'service_role' then
    perform public.user_em_obra(p_obra_id);
  end if;

  select id into v_baseline_id
  from public.cronograma_baselines
  where obra_id = p_obra_id
  order by versao desc
  limit 1;

  insert into public.medicoes (
    obra_id, numero, data_inicio, data_corte, valor, status, observacoes, baseline_id
  ) values (
    p_obra_id, p_numero, p_data_inicio, p_data_corte,
    coalesce(p_valor_total, 0), 'rascunho', nullif(p_observacoes, ''), v_baseline_id
  )
  returning id into v_medicao_id;

  if p_itens is not null and jsonb_array_length(p_itens) > 0 then
    insert into public.itens_medicao (
      medicao_id, cronograma_item_id,
      percentual_anterior, percentual_atual,
      valor_anterior, valor_atual
    )
    select v_medicao_id, (it->>'cronograma_item_id')::uuid,
      coalesce((it->>'percentual_anterior')::numeric, 0),
      coalesce((it->>'percentual_atual')::numeric, 0),
      coalesce((it->>'valor_anterior')::numeric, 0),
      coalesce((it->>'valor_atual')::numeric, 0)
    from jsonb_array_elements(p_itens) as it
    where (it->>'cronograma_item_id') is not null;

    update public.cronograma_itens ci
    set percentual_realizado = sub.pct_atual
    from (
      select (it->>'cronograma_item_id')::uuid as item_id,
             coalesce((it->>'percentual_atual')::numeric, 0) as pct_atual
      from jsonb_array_elements(p_itens) as it
      where (it->>'cronograma_item_id') is not null
    ) sub
    where ci.id = sub.item_id;
  end if;

  if p_bms_id is not null then
    update public.bms_previstas
    set status = 'aberta', medicao_id = v_medicao_id
    where id = p_bms_id;
  end if;

  return v_medicao_id;
end;
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

  IF auth.role() <> 'service_role' THEN
    PERFORM public.user_em_obra(v_oc.obra_id);
  END IF;

  IF v_oc.status <> 'rascunho' THEN
    RAISE EXCEPTION 'OC já está em status %, não pode ser emitida', v_oc.status USING ERRCODE='P0001';
  END IF;
  IF v_oc.status_aprovacao <> 'aprovada' THEN
    RAISE EXCEPTION 'OC precisa estar aprovada antes de ser emitida' USING ERRCODE='P0001';
  END IF;
  SELECT count(*) INTO v_qtd_itens FROM public.ordem_compra_itens WHERE ordem_compra_id = p_oc_id;
  IF v_qtd_itens = 0 THEN RAISE EXCEPTION 'OC sem itens não pode ser emitida' USING ERRCODE='P0001'; END IF;
  UPDATE public.ordens_compra SET status='emitida', emitida_em=COALESCE(emitida_em, now()) WHERE id = p_oc_id;
  SELECT array_agg(DISTINCT requisicao_id) INTO v_req_ids
    FROM public.ordem_compra_itens WHERE ordem_compra_id = p_oc_id AND requisicao_id IS NOT NULL;
  IF v_req_ids IS NOT NULL AND array_length(v_req_ids,1) > 0 THEN
    UPDATE public.requisicoes SET status='atendida' WHERE id = ANY(v_req_ids);
  END IF;
  RETURN jsonb_build_object('ok', true, 'oc_id', p_oc_id, 'qtd_itens', v_qtd_itens,
    'requisicoes', COALESCE(array_length(v_req_ids,1), 0));
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
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC % não encontrada', p_oc_id USING ERRCODE='P0002'; END IF;

  IF auth.role() <> 'service_role' THEN
    PERFORM public.user_em_obra(v_oc.obra_id);
  END IF;

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
      RAISE EXCEPTION 'Quantidade % excede saldo do item % (pedido=%, recebido=%)',
        v_entry.qtd, v_entry.item_id, v_pedido, v_recebido USING ERRCODE='P0001';
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
     WHERE (e->>'quantidade')::numeric > 0 AND oci.insumo_id IS NOT NULL
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
  UPDATE public.ordens_compra SET status = v_novo_st WHERE id = p_oc_id;

  RETURN jsonb_build_object('ok', true, 'recebimento_id', v_rec_id, 'oc_id', p_oc_id,
    'novo_status', v_novo_st, 'total_quantidade', v_total_qtd);
END;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_nf_atomica(p_nf_id uuid, p_payload jsonb, p_data_prevista date, p_valor_liquido numeric, p_bms_prevista_id uuid, p_medicao_id_fallback uuid, p_valor_contrato numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_nf_id          uuid;
  v_obra_id        uuid;
  v_bms_atual_id   uuid;
begin
  v_obra_id := (p_payload->>'obra_id')::uuid;
  if v_obra_id is null then
    raise exception 'payload sem obra_id';
  end if;

  if auth.role() <> 'service_role' then
    perform public.user_em_obra(v_obra_id);
  end if;

  if p_nf_id is null then
    insert into public.notas_fiscais
    select * from jsonb_populate_record(null::public.notas_fiscais, p_payload)
    returning id into v_nf_id;

    insert into public.recebimentos (
      obra_id, nota_fiscal_id, data_prevista,
      valor_previsto, valor_previsto_inicial,
      status, origem, congelado
    )
    values (
      v_obra_id, v_nf_id, p_data_prevista,
      p_valor_liquido, p_valor_liquido,
      'a_receber', 'nf', true
    );
  else
    v_nf_id := p_nf_id;

    update public.notas_fiscais nf
    set obra_id            = coalesce(p.obra_id, nf.obra_id),
        medicao_id         = p.medicao_id,
        numero             = p.numero,
        data_emissao       = p.data_emissao,
        competencia        = p.competencia,
        valor              = coalesce(p.valor, nf.valor),
        valor_servicos     = p.valor_servicos,
        valor_material     = p.valor_material,
        percentual_material= p.percentual_material,
        inss_retido        = p.inss_retido,
        iss_retido         = p.iss_retido,
        retencao_cbs       = p.retencao_cbs,
        retencao_ibs       = p.retencao_ibs,
        outras_retencoes   = p.outras_retencoes,
        valor_liquido      = p.valor_liquido,
        codigo_cno         = p.codigo_cno,
        codigo_art         = p.codigo_art,
        codigo_verificacao = p.codigo_verificacao,
        data_vencimento    = p.data_vencimento,
        pdf_url            = coalesce(p.pdf_url, nf.pdf_url)
    from jsonb_populate_record(null::public.notas_fiscais, p_payload) p
    where nf.id = p_nf_id;

    update public.recebimentos
    set valor_previsto         = p_valor_liquido,
        valor_previsto_inicial = p_valor_liquido,
        data_prevista          = p_data_prevista
    where nota_fiscal_id = p_nf_id
      and data_recebimento is null;
  end if;

  select id into v_bms_atual_id
  from public.bms_previstas
  where nota_fiscal_id = v_nf_id
  limit 1;

  if v_bms_atual_id is not null and v_bms_atual_id is distinct from p_bms_prevista_id then
    update public.bms_previstas
    set nota_fiscal_id = null, status = 'prevista'
    where id = v_bms_atual_id;
  end if;

  if p_bms_prevista_id is not null
     and (v_bms_atual_id is null or v_bms_atual_id is distinct from p_bms_prevista_id) then
    update public.bms_previstas
    set nota_fiscal_id = v_nf_id, status = 'faturada'
    where id = p_bms_prevista_id;
  elsif p_nf_id is null
        and p_bms_prevista_id is null
        and p_medicao_id_fallback is not null then
    update public.bms_previstas
    set nota_fiscal_id = v_nf_id, status = 'faturada'
    where obra_id = v_obra_id
      and medicao_id = p_medicao_id_fallback;
  end if;

  perform public.fn_recalcular_previsao_nf(v_obra_id, p_valor_contrato);

  return jsonb_build_object('nf_id', v_nf_id, 'obra_id', v_obra_id);
end;
$function$;
