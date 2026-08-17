
CREATE OR REPLACE FUNCTION public.fn_estoque_transferir(
  p_insumo uuid,
  p_origem text,
  p_destino text,
  p_quantidade numeric,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_origem numeric;
  v_ref uuid := gen_random_uuid();
  v_origem_tag text;
BEGIN
  IF NOT (public.current_is_gm() OR public.current_has_setor('Compras')) THEN
    RAISE EXCEPTION 'Sem permissão para transferir estoque';
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

  UPDATE public.estoque_saldos
     SET saldo = saldo - p_quantidade, updated_at = now()
   WHERE local = p_origem AND insumo_id = p_insumo;

  INSERT INTO public.estoque_saldos(local, insumo_id, saldo)
  VALUES (p_destino, p_insumo, p_quantidade)
  ON CONFLICT (local, insumo_id) DO UPDATE
     SET saldo = public.estoque_saldos.saldo + EXCLUDED.saldo,
         updated_at = now();

  RETURN jsonb_build_object('ref', v_ref, 'quantidade', p_quantidade);
END $$;

REVOKE ALL ON FUNCTION public.fn_estoque_transferir(uuid, text, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_estoque_transferir(uuid, text, text, numeric, text) TO authenticated, service_role;
