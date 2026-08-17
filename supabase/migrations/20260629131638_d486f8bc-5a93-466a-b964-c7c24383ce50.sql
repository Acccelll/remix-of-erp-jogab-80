CREATE OR REPLACE FUNCTION public.emitir_oc_atomico(p_oc_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_oc public.ordens_compra%ROWTYPE;
  v_qtd_itens integer;
  v_req_ids uuid[];
BEGIN
  SELECT * INTO v_oc FROM public.ordens_compra WHERE id = p_oc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OC % não encontrada', p_oc_id USING ERRCODE='P0002'; END IF;
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
$$;
REVOKE ALL ON FUNCTION public.emitir_oc_atomico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_oc_atomico(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_atomico(
  p_oc_id uuid, p_nota_fiscal text, p_data date, p_observacao text,
  p_itens jsonb, p_owner_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;
REVOKE ALL ON FUNCTION public.registrar_recebimento_atomico(uuid, text, date, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_atomico(uuid, text, date, text, jsonb, uuid) TO authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS estoque_saldos_local_insumo_uq ON public.estoque_saldos(local, insumo_id);