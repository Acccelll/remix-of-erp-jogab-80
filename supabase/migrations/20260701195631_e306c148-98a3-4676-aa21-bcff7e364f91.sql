-- Hardening incremental das políticas de leitura ainda amplas apontadas pela auditoria.

-- CRONOGRAMA / CUSTOS
DROP POLICY IF EXISTS "cronograma_baselines select" ON public.cronograma_baselines;
CREATE POLICY "cronograma_baselines select por obra" ON public.cronograma_baselines
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cronograma_calendarios select" ON public.cronograma_calendarios;
CREATE POLICY "cronograma_calendarios select por obra" ON public.cronograma_calendarios
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cronograma_dependencias select" ON public.cronograma_dependencias;
CREATE POLICY "cronograma_dependencias select por obra" ON public.cronograma_dependencias
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cronograma_marcos select" ON public.cronograma_marcos;
CREATE POLICY "cronograma_marcos select por obra" ON public.cronograma_marcos
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cronograma_revisoes select" ON public.cronograma_revisoes;
CREATE POLICY "cronograma_revisoes select por obra" ON public.cronograma_revisoes
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cronograma_item_baseline select" ON public.cronograma_item_baseline;
CREATE POLICY "cronograma_item_baseline select por obra" ON public.cronograma_item_baseline
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.cronograma_baselines cb
    WHERE cb.id = cronograma_item_baseline.baseline_id
      AND public.user_em_obra(cb.obra_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.cronograma_itens ci
    WHERE ci.id = cronograma_item_baseline.cronograma_item_id
      AND public.user_em_obra(ci.obra_id)
  )
);

DROP POLICY IF EXISTS "cenario_itens select" ON public.cronograma_cenario_itens;
CREATE POLICY "cenario_itens select por cenario" ON public.cronograma_cenario_itens
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1 FROM public.cronograma_cenarios c
    WHERE c.id = cronograma_cenario_itens.cenario_id
      AND (c.criado_por = auth.uid() OR public.user_em_obra(c.obra_id))
  )
  OR EXISTS (
    SELECT 1 FROM public.cronograma_itens ci
    WHERE ci.id = cronograma_cenario_itens.item_id
      AND public.user_em_obra(ci.obra_id)
  )
);

-- BMs / MEDIÇÕES / RECEBÍVEIS
DROP POLICY IF EXISTS "bmsprev_select" ON public.bms_previstas;
CREATE POLICY "bmsprev_select por obra ou financeiro" ON public.bms_previstas
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro') OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "bmsred_select" ON public.bms_redistribuicao;
CREATE POLICY "bmsred_select por obra ou financeiro" ON public.bms_redistribuicao
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro') OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "receb_select" ON public.recebimentos;
CREATE POLICY "receb_select por obra ou financeiro" ON public.recebimentos
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Financeiro') OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "contrato_medicoes read" ON public.contrato_medicoes;
CREATE POLICY "contrato_medicoes read por contrato" ON public.contrato_medicoes
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Contratos')
  OR public.current_has_setor('Financeiro')
  OR EXISTS (
    SELECT 1 FROM public.contratos c
    WHERE c.id = contrato_medicoes.contrato_id
      AND public.user_em_obra(c.obra_id)
  )
);

DROP POLICY IF EXISTS "itmed_select" ON public.itens_medicao;
CREATE POLICY "itmed_select por medicao" ON public.itens_medicao
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR EXISTS (
    SELECT 1 FROM public.medicoes m
    WHERE m.id = itens_medicao.medicao_id
      AND public.user_em_obra(m.obra_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.cronograma_itens ci
    WHERE ci.id = itens_medicao.cronograma_item_id
      AND public.user_em_obra(ci.obra_id)
  )
);

-- SUPRIMENTOS
DROP POLICY IF EXISTS "requisicoes read" ON public.requisicoes;
CREATE POLICY "requisicoes read por obra ou compras" ON public.requisicoes
FOR SELECT TO authenticated
USING (public.current_is_gm() OR public.current_has_setor('Compras') OR public.user_em_obra(obra_id));

DROP POLICY IF EXISTS "cotacoes read" ON public.cotacoes;
CREATE POLICY "cotacoes read por requisicao" ON public.cotacoes
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR EXISTS (
    SELECT 1 FROM public.requisicoes r
    WHERE r.id = cotacoes.requisicao_id
      AND public.user_em_obra(r.obra_id)
  )
);

DROP POLICY IF EXISTS "cotacao_propostas read" ON public.cotacao_propostas;
CREATE POLICY "cotacao_propostas read por cotacao" ON public.cotacao_propostas
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR EXISTS (
    SELECT 1
    FROM public.cotacoes c
    JOIN public.requisicoes r ON r.id = c.requisicao_id
    WHERE c.id = cotacao_propostas.cotacao_id
      AND public.user_em_obra(r.obra_id)
  )
);

DROP POLICY IF EXISTS "ordem_compra_itens read" ON public.ordem_compra_itens;
CREATE POLICY "ordem_compra_itens read por oc" ON public.ordem_compra_itens
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR EXISTS (
    SELECT 1 FROM public.ordens_compra oc
    WHERE oc.id = ordem_compra_itens.ordem_compra_id
      AND public.user_em_obra(oc.obra_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.requisicoes r
    WHERE r.id = ordem_compra_itens.requisicao_id
      AND public.user_em_obra(r.obra_id)
  )
);

DROP POLICY IF EXISTS "recebimento_materiais read" ON public.recebimento_materiais;
CREATE POLICY "recebimento_materiais read por oc" ON public.recebimento_materiais
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Engenharia')
  OR EXISTS (
    SELECT 1 FROM public.ordens_compra oc
    WHERE oc.id = recebimento_materiais.ordem_compra_id
      AND public.user_em_obra(oc.obra_id)
  )
);

DROP POLICY IF EXISTS "recebimento_itens read" ON public.recebimento_itens;
CREATE POLICY "recebimento_itens read por recebimento" ON public.recebimento_itens
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Engenharia')
  OR EXISTS (
    SELECT 1
    FROM public.recebimento_materiais rm
    JOIN public.ordens_compra oc ON oc.id = rm.ordem_compra_id
    WHERE rm.id = recebimento_itens.recebimento_id
      AND public.user_em_obra(oc.obra_id)
  )
);

-- FROTA / ESTOQUE / PREÇOS E COMPOSIÇÕES
DROP POLICY IF EXISTS "frota_manut read" ON public.frota_manutencoes;
CREATE POLICY "frota_manut read por obra ou setor" ON public.frota_manutencoes
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Compras')
  OR (obra_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND public.user_em_obra(obra_id::uuid))
);

DROP POLICY IF EXISTS "frota_abast read" ON public.frota_abastecimentos;
CREATE POLICY "frota_abast read por obra ou setor" ON public.frota_abastecimentos
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Compras')
  OR (obra_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND public.user_em_obra(obra_id::uuid))
);

DROP POLICY IF EXISTS "frota_aprop read" ON public.frota_apropriacao;
CREATE POLICY "frota_aprop read por obra ou setor" ON public.frota_apropriacao
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Compras')
  OR (obra_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND public.user_em_obra(obra_id::uuid))
);

DROP POLICY IF EXISTS "estoque_saldos read" ON public.estoque_saldos;
CREATE POLICY "estoque_saldos read por setor" ON public.estoque_saldos
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Engenharia')
);

DROP POLICY IF EXISTS "estoque_movimentacoes read" ON public.estoque_movimentacoes;
CREATE POLICY "estoque_movimentacoes read por setor" ON public.estoque_movimentacoes
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Engenharia')
);

DROP POLICY IF EXISTS "insumos read" ON public.insumos;
CREATE POLICY "insumos read por setor tecnico" ON public.insumos
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Orcamento')
);

DROP POLICY IF EXISTS "comp read" ON public.composicoes;
CREATE POLICY "comp read por setor tecnico" ON public.composicoes
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Orcamento')
);

DROP POLICY IF EXISTS "compitens read" ON public.composicao_itens;
CREATE POLICY "compitens read por setor tecnico" ON public.composicao_itens
FOR SELECT TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Orcamento')
);