-- Fase 2+3 (evolução de Suprimentos): Almoxarifado formal (depósitos) +
-- Solicitação de campo/planejada com triagem obrigatória.
--
-- Desenho deliberadamente incremental e retrocompatível:
--  - `local text` NÃO é removido de estoque_saldos/estoque_movimentacoes —
--    fica como coluna legada até uma migration futura de limpeza, depois de
--    confirmar em produção que o backfill cobriu 100% dos casos.
--  - registrar_recebimento_atomico e fn_estoque_transferir mantêm a MESMA
--    assinatura de antes (nenhuma tela existente precisa mudar) — passam a
--    resolver e gravar deposito_id internamente, via fn_deposito_obra_padrao.
--  - Pendência de design já registrada no roadmap: quando uma obra tiver mais
--    de um depósito 'obra', ainda não há como a OC/requisição escolher qual
--    recebe a mercadoria — fn_deposito_obra_padrao sempre resolve para o mais
--    antigo. Ajustar quando essa escolha explícita for priorizada.

-- =========================================================================
-- 1. Depósitos (Fase 3)
-- =========================================================================
CREATE TABLE public.depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('central','obra')),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT depositos_obra_coerente CHECK (
    (tipo = 'central' AND obra_id IS NULL) OR (tipo = 'obra' AND obra_id IS NOT NULL)
  )
);
CREATE INDEX idx_depositos_obra ON public.depositos(obra_id);

DROP TRIGGER IF EXISTS touch_depositos ON public.depositos;
CREATE TRIGGER touch_depositos BEFORE UPDATE ON public.depositos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: 1 depósito central.
INSERT INTO public.depositos (nome, tipo, obra_id)
SELECT 'Almoxarifado Central', 'central', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.depositos WHERE tipo = 'central');

-- Backfill: 1 depósito 'obra' para cada obra_id já usado como `local` em
-- estoque_saldos/estoque_movimentacoes (hoje sempre um UUID de obra — ver
-- achado registrado no roadmap). Regex evita quebrar caso exista algum
-- `local` legado que não seja UUID de obra (não fica sem depósito, só não
-- entra neste backfill automático).
INSERT INTO public.depositos (nome, tipo, obra_id)
SELECT DISTINCT 'Almoxarifado — ' || COALESCE(o.nome, e.local), 'obra', e.local::uuid
FROM (
  SELECT local FROM public.estoque_saldos
  UNION
  SELECT local FROM public.estoque_movimentacoes
) e
LEFT JOIN public.obras o ON o.id = e.local::uuid
WHERE e.local ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.depositos d WHERE d.tipo = 'obra' AND d.obra_id = e.local::uuid
  );

-- Resolve (ou cria sob demanda) o depósito 'obra' padrão de uma obra.
-- Usado pelas RPCs de recebimento/transferência para não exigir que todo
-- call-site existente já saiba escolher depósito explicitamente.
CREATE OR REPLACE FUNCTION public.fn_deposito_obra_padrao(p_obra_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deposito_id uuid;
  v_obra_nome text;
BEGIN
  SELECT id INTO v_deposito_id FROM public.depositos
    WHERE tipo = 'obra' AND obra_id = p_obra_id
    ORDER BY created_at ASC LIMIT 1;
  IF v_deposito_id IS NOT NULL THEN RETURN v_deposito_id; END IF;

  SELECT nome INTO v_obra_nome FROM public.obras WHERE id = p_obra_id;
  INSERT INTO public.depositos (nome, tipo, obra_id)
  VALUES ('Almoxarifado — ' || COALESCE(v_obra_nome, p_obra_id::text), 'obra', p_obra_id)
  RETURNING id INTO v_deposito_id;
  RETURN v_deposito_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_deposito_obra_padrao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_deposito_obra_padrao(uuid) TO authenticated, service_role;

-- estoque_saldos / estoque_movimentacoes ganham deposito_id (aditivo).
ALTER TABLE public.estoque_saldos ADD COLUMN IF NOT EXISTS deposito_id uuid REFERENCES public.depositos(id);
ALTER TABLE public.estoque_saldos ADD COLUMN IF NOT EXISTS saldo_reservado numeric(14,4) NOT NULL DEFAULT 0;
ALTER TABLE public.estoque_movimentacoes ADD COLUMN IF NOT EXISTS deposito_id uuid REFERENCES public.depositos(id);

UPDATE public.estoque_saldos e SET deposito_id = d.id
FROM public.depositos d
WHERE e.deposito_id IS NULL
  AND e.local ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND d.tipo = 'obra' AND d.obra_id = e.local::uuid;

UPDATE public.estoque_movimentacoes e SET deposito_id = d.id
FROM public.depositos d
WHERE e.deposito_id IS NULL
  AND e.local ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND d.tipo = 'obra' AND d.obra_id = e.local::uuid;

-- Índice único por depósito×insumo, em paralelo ao antigo (local, insumo_id)
-- — parcial, só entre linhas já migradas, para não quebrar caso ainda haja
-- alguma linha sem deposito_id resolvido.
CREATE UNIQUE INDEX IF NOT EXISTS estoque_saldos_deposito_insumo_uq
  ON public.estoque_saldos(deposito_id, insumo_id) WHERE deposito_id IS NOT NULL;

-- Transferências como entidade rastreável (Fase 3) — antes só existia como
-- efeito colateral não registrado da chamada de fn_estoque_transferir.
CREATE TABLE public.estoque_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE RESTRICT,
  deposito_origem_id uuid NOT NULL REFERENCES public.depositos(id),
  deposito_destino_id uuid NOT NULL REFERENCES public.depositos(id),
  quantidade numeric(14,4) NOT NULL CHECK (quantidade > 0),
  status text NOT NULL DEFAULT 'concluida' CHECK (status IN ('solicitada','em_transito','concluida','cancelada')),
  solicitante uuid DEFAULT auth.uid(),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz
);
CREATE INDEX idx_estoque_transf_insumo ON public.estoque_transferencias(insumo_id);

-- =========================================================================
-- 2. Reescrita das RPCs existentes (mesma assinatura, resolvem depósito)
-- =========================================================================
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
  v_deposito_id uuid;
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

  v_deposito_id := public.fn_deposito_obra_padrao(v_oc.obra_id);

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
    INSERT INTO public.estoque_movimentacoes (local, deposito_id, insumo_id, tipo, quantidade, origem, observacao, owner_id)
    VALUES (v_oc.obra_id, v_deposito_id, v_item.insumo_id, 'entrada', v_item.qtd, 'recebimento:'||v_rec_id,
      CASE WHEN NULLIF(p_nota_fiscal,'') IS NOT NULL THEN 'NF '||p_nota_fiscal END, p_owner_id);
    INSERT INTO public.estoque_saldos (local, deposito_id, insumo_id, saldo)
    VALUES (v_oc.obra_id, v_deposito_id, v_item.insumo_id, v_item.qtd)
    ON CONFLICT (local, insumo_id) DO UPDATE
      SET saldo = public.estoque_saldos.saldo + EXCLUDED.saldo,
          deposito_id = EXCLUDED.deposito_id;
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
    'novo_status', v_novo_st, 'total_quantidade', v_total_qtd, 'deposito_id', v_deposito_id);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_recebimento_atomico(uuid, text, date, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento_atomico(uuid, text, date, text, jsonb, uuid) TO authenticated, service_role;

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
  v_deposito_origem_id uuid;
  v_deposito_destino_id uuid;
BEGIN
  PERFORM public._require_any_setor_or_gm('Compras', 'Almoxarifado');
  IF p_origem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public._require_obra_edit(p_origem::uuid);
    v_deposito_origem_id := public.fn_deposito_obra_padrao(p_origem::uuid);
  END IF;
  IF p_destino ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    PERFORM public._require_obra_edit(p_destino::uuid);
    v_deposito_destino_id := public.fn_deposito_obra_padrao(p_destino::uuid);
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
  INSERT INTO public.estoque_movimentacoes(local, deposito_id, insumo_id, tipo, quantidade, origem, observacao)
  VALUES (p_origem, v_deposito_origem_id, p_insumo, 'saida', p_quantidade, v_origem_tag, p_observacao),
         (p_destino, v_deposito_destino_id, p_insumo, 'entrada', p_quantidade, v_origem_tag, p_observacao);

  UPDATE public.estoque_saldos SET saldo = saldo - p_quantidade, updated_at = now()
  WHERE local = p_origem AND insumo_id = p_insumo;

  INSERT INTO public.estoque_saldos(local, deposito_id, insumo_id, saldo)
  VALUES (p_destino, v_deposito_destino_id, p_insumo, p_quantidade)
  ON CONFLICT (local, insumo_id) DO UPDATE
    SET saldo = public.estoque_saldos.saldo + EXCLUDED.saldo,
        deposito_id = EXCLUDED.deposito_id,
        updated_at = now();

  IF v_deposito_origem_id IS NOT NULL AND v_deposito_destino_id IS NOT NULL THEN
    INSERT INTO public.estoque_transferencias
      (insumo_id, deposito_origem_id, deposito_destino_id, quantidade, status, observacao, concluida_em)
    VALUES (p_insumo, v_deposito_origem_id, v_deposito_destino_id, p_quantidade, 'concluida', p_observacao, now());
  END IF;

  RETURN jsonb_build_object('ref', v_ref, 'quantidade', p_quantidade);
END;
$function$;

-- =========================================================================
-- 3. Solicitação de campo / planejada (Fase 2)
-- =========================================================================
CREATE TABLE public.solicitacoes_almoxarifado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  cronograma_item_id uuid NOT NULL REFERENCES public.cronograma_itens(id) ON DELETE RESTRICT,
  card_recurso_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'campo' CHECK (origem IN ('planejada','campo')),
  solicitante uuid DEFAULT auth.uid(),
  urgencia text NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('normal','urgente')),
  observacao text,
  status text NOT NULL DEFAULT 'triagem' CHECK (status IN ('triagem','resolvida','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_solic_almox_obra ON public.solicitacoes_almoxarifado(obra_id);
CREATE INDEX idx_solic_almox_cronograma ON public.solicitacoes_almoxarifado(cronograma_item_id);
CREATE INDEX idx_solic_almox_card_recurso ON public.solicitacoes_almoxarifado(card_recurso_id);
CREATE INDEX idx_solic_almox_status ON public.solicitacoes_almoxarifado(status);

DROP TRIGGER IF EXISTS touch_solic_almox ON public.solicitacoes_almoxarifado;
CREATE TRIGGER touch_solic_almox BEFORE UPDATE ON public.solicitacoes_almoxarifado
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.solicitacao_almoxarifado_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_almoxarifado(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES public.insumos(id) ON DELETE SET NULL,
  descricao_livre text,
  quantidade numeric(14,4) NOT NULL DEFAULT 0 CHECK (quantidade > 0),
  unidade text,
  atendido_estoque boolean NOT NULL DEFAULT false,
  requisicao_id uuid REFERENCES public.requisicoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT solic_item_descricao_ou_insumo CHECK (insumo_id IS NOT NULL OR descricao_livre IS NOT NULL)
);
CREATE INDEX idx_solic_item_solicitacao ON public.solicitacao_almoxarifado_itens(solicitacao_id);

DROP TRIGGER IF EXISTS touch_solic_almox_itens ON public.solicitacao_almoxarifado_itens;
CREATE TRIGGER touch_solic_almox_itens BEFORE UPDATE ON public.solicitacao_almoxarifado_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cabeçalho passa a 'resolvida' quando todo item já foi atendido do estoque
-- ou encaminhado para compras (não força um enum de status por item, já que
-- uma solicitação com N itens pode ter destinos diferentes por item).
CREATE OR REPLACE FUNCTION public.fn_solic_almox_atualizar_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_todos_resolvidos boolean;
BEGIN
  SELECT bool_and(atendido_estoque OR requisicao_id IS NOT NULL) INTO v_todos_resolvidos
  FROM public.solicitacao_almoxarifado_itens
  WHERE solicitacao_id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id);

  UPDATE public.solicitacoes_almoxarifado
  SET status = CASE WHEN v_todos_resolvidos THEN 'resolvida' ELSE 'triagem' END
  WHERE id = COALESCE(NEW.solicitacao_id, OLD.solicitacao_id)
    AND status <> 'cancelada';

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_solic_almox_item_status ON public.solicitacao_almoxarifado_itens;
CREATE TRIGGER trg_solic_almox_item_status
  AFTER INSERT OR UPDATE OF atendido_estoque, requisicao_id ON public.solicitacao_almoxarifado_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_solic_almox_atualizar_status();

-- Ação de triagem 1: atender o item diretamente do depósito da obra.
CREATE OR REPLACE FUNCTION public.fn_atender_item_estoque(p_item_id uuid, p_deposito_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.solicitacao_almoxarifado_itens%ROWTYPE;
  v_solicitacao public.solicitacoes_almoxarifado%ROWTYPE;
  v_saldo numeric;
BEGIN
  PERFORM public._require_any_setor_or_gm('Almoxarifado', 'Compras');
  SELECT * INTO v_item FROM public.solicitacao_almoxarifado_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item % não encontrado', p_item_id USING ERRCODE='P0002'; END IF;
  IF v_item.insumo_id IS NULL THEN
    RAISE EXCEPTION 'Item sem insumo cadastrado não pode ser atendido do estoque (só encaminhado para compras)' USING ERRCODE='P0001';
  END IF;
  IF v_item.atendido_estoque OR v_item.requisicao_id IS NOT NULL THEN
    RAISE EXCEPTION 'Item já foi resolvido' USING ERRCODE='P0001';
  END IF;

  SELECT saldo - saldo_reservado INTO v_saldo FROM public.estoque_saldos
  WHERE deposito_id = p_deposito_id AND insumo_id = v_item.insumo_id FOR UPDATE;
  IF v_saldo IS NULL OR v_saldo < v_item.quantidade THEN
    RAISE EXCEPTION 'Saldo disponível insuficiente no depósito (disponível: %)', COALESCE(v_saldo, 0) USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_solicitacao FROM public.solicitacoes_almoxarifado WHERE id = v_item.solicitacao_id;

  UPDATE public.estoque_saldos SET saldo = saldo - v_item.quantidade
  WHERE deposito_id = p_deposito_id AND insumo_id = v_item.insumo_id;

  INSERT INTO public.estoque_movimentacoes (local, deposito_id, insumo_id, tipo, quantidade, origem, observacao)
  VALUES (v_solicitacao.obra_id, p_deposito_id, v_item.insumo_id, 'saida', v_item.quantidade,
    'solicitacao_almoxarifado:'||v_item.solicitacao_id, 'Atendido direto do estoque');

  UPDATE public.solicitacao_almoxarifado_itens SET atendido_estoque = true WHERE id = p_item_id;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_atender_item_estoque(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_atender_item_estoque(uuid, uuid) TO authenticated, service_role;

-- Ação de triagem 2: sem saldo — encaminha para o fluxo de compras existente
-- (cria uma linha em requisicoes, sem alterar nada do fluxo já existente).
CREATE OR REPLACE FUNCTION public.fn_encaminhar_item_compras(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.solicitacao_almoxarifado_itens%ROWTYPE;
  v_solicitacao public.solicitacoes_almoxarifado%ROWTYPE;
  v_requisicao_id uuid;
BEGIN
  PERFORM public._require_any_setor_or_gm('Almoxarifado', 'Compras');
  SELECT * INTO v_item FROM public.solicitacao_almoxarifado_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item % não encontrado', p_item_id USING ERRCODE='P0002'; END IF;
  IF v_item.atendido_estoque OR v_item.requisicao_id IS NOT NULL THEN
    RAISE EXCEPTION 'Item já foi resolvido' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_solicitacao FROM public.solicitacoes_almoxarifado WHERE id = v_item.solicitacao_id;

  INSERT INTO public.requisicoes (obra_id, card_recurso_id, insumo_id, quantidade, status, observacao)
  VALUES (
    v_solicitacao.obra_id, v_solicitacao.card_recurso_id, v_item.insumo_id, v_item.quantidade, 'aberta',
    COALESCE(v_item.descricao_livre, 'Originada da solicitação de almoxarifado ' || v_solicitacao.id::text)
  )
  RETURNING id INTO v_requisicao_id;

  UPDATE public.solicitacao_almoxarifado_itens SET requisicao_id = v_requisicao_id WHERE id = p_item_id;

  RETURN jsonb_build_object('ok', true, 'item_id', p_item_id, 'requisicao_id', v_requisicao_id);
END;
$$;
REVOKE ALL ON FUNCTION public.fn_encaminhar_item_compras(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_encaminhar_item_compras(uuid) TO authenticated, service_role;

-- Automação da origem 'planejada': quando a cascata de prazos de um recurso
-- (card_recursos.prazo_notif_compras) chega, gera a solicitação sozinha —
-- hoje isso não existia (achado confirmado no roadmap: só há um lembrete
-- genérico de prazo de card, sem esta automação).
CREATE OR REPLACE FUNCTION public.fn_gerar_solicitacoes_planejadas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec record;
  v_solicitacao_id uuid;
  v_count integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    PERFORM public._require_any_setor_or_gm('Almoxarifado', 'Compras');
  END IF;

  FOR v_rec IN
    SELECT c.id AS card_id, c.obra_id, c.cronograma_item_id,
           cr.especificacao, cr.quantidade, cr.unidade
    FROM public.card_recursos cr
    JOIN public.cards c ON c.id = cr.card_id
    WHERE cr.prazo_notif_compras <= CURRENT_DATE
      AND c.cronograma_item_id IS NOT NULL
      AND c.arquivado = false
      AND NOT EXISTS (
        SELECT 1 FROM public.solicitacoes_almoxarifado sa WHERE sa.card_recurso_id = c.id
      )
  LOOP
    INSERT INTO public.solicitacoes_almoxarifado
      (obra_id, cronograma_item_id, card_recurso_id, origem, urgencia, status)
    VALUES (v_rec.obra_id, v_rec.cronograma_item_id, v_rec.card_id, 'planejada', 'normal', 'triagem')
    RETURNING id INTO v_solicitacao_id;

    INSERT INTO public.solicitacao_almoxarifado_itens
      (solicitacao_id, descricao_livre, quantidade, unidade)
    VALUES (v_solicitacao_id, v_rec.especificacao, COALESCE(v_rec.quantidade, 0), v_rec.unidade);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_gerar_solicitacoes_planejadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_gerar_solicitacoes_planejadas() TO authenticated, service_role;

-- Agenda diária (mesmo padrão de fn_nc_notificar_prazos).
DO $$
BEGIN
  PERFORM cron.unschedule('gerar-solicitacoes-planejadas-diario');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'gerar-solicitacoes-planejadas-diario',
  '0 11 * * *',
  $$ SELECT public.fn_gerar_solicitacoes_planejadas(); $$
);

-- =========================================================================
-- 4. GRANTs e RLS — mesmo padrão de Suprimentos (Fase 5A / 20260625182038)
-- =========================================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'depositos', 'estoque_transferencias',
    'solicitacoes_almoxarifado', 'solicitacao_almoxarifado_itens'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

CREATE POLICY "depositos read" ON public.depositos FOR SELECT TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras')
    OR public.current_has_setor('Producao') OR public.current_has_setor('Engenharia')
    OR (obra_id IS NOT NULL AND public.user_em_obra(obra_id)));
CREATE POLICY "depositos write" ON public.depositos FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'));

CREATE POLICY "estoque_transferencias read" ON public.estoque_transferencias FOR SELECT TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras')
    OR public.current_has_setor('Producao') OR public.current_has_setor('Engenharia'));
CREATE POLICY "estoque_transferencias write" ON public.estoque_transferencias FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'));

CREATE POLICY "solicitacoes_almoxarifado read" ON public.solicitacoes_almoxarifado FOR SELECT TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras')
    OR public.current_has_setor('Producao') OR public.current_has_setor('Engenharia')
    OR public.user_em_obra(obra_id));
CREATE POLICY "solicitacoes_almoxarifado insert" ON public.solicitacoes_almoxarifado FOR INSERT TO authenticated
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras')
    OR public.current_has_setor('Producao') OR public.current_has_setor('Engenharia')
    OR public.user_em_obra(obra_id));
CREATE POLICY "solicitacoes_almoxarifado update" ON public.solicitacoes_almoxarifado FOR UPDATE TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'));

CREATE POLICY "solicitacao_almoxarifado_itens read" ON public.solicitacao_almoxarifado_itens FOR SELECT TO authenticated
  USING (
    public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras')
    OR public.current_has_setor('Producao') OR public.current_has_setor('Engenharia')
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_almoxarifado sa
      WHERE sa.id = solicitacao_almoxarifado_itens.solicitacao_id AND public.user_em_obra(sa.obra_id)
    )
  );
CREATE POLICY "solicitacao_almoxarifado_itens insert" ON public.solicitacao_almoxarifado_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras')
    OR public.current_has_setor('Producao') OR public.current_has_setor('Engenharia')
    OR EXISTS (
      SELECT 1 FROM public.solicitacoes_almoxarifado sa
      WHERE sa.id = solicitacao_almoxarifado_itens.solicitacao_id AND public.user_em_obra(sa.obra_id)
    )
  );
CREATE POLICY "solicitacao_almoxarifado_itens update" ON public.solicitacao_almoxarifado_itens FOR UPDATE TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Almoxarifado') OR public.current_has_setor('Compras'));
