-- ETAPA 6 — Operações canônicas: edição, cancelamento/reabertura e estorno imutável.

ALTER TABLE public.financeiro_titulo_baixas
  ADD COLUMN tipo_movimento text NOT NULL DEFAULT 'baixa',
  ADD COLUMN baixa_origem_id uuid NULL REFERENCES public.financeiro_titulo_baixas(id) ON DELETE RESTRICT;

ALTER TABLE public.financeiro_titulo_baixas
  ADD CONSTRAINT financeiro_titulo_baixas_tipo_movimento_ck
    CHECK (tipo_movimento IN ('baixa', 'estorno')),
  ADD CONSTRAINT financeiro_titulo_baixas_estorno_origem_ck
    CHECK (
      (tipo_movimento = 'baixa' AND baixa_origem_id IS NULL)
      OR (tipo_movimento = 'estorno' AND baixa_origem_id IS NOT NULL)
    ),
  ADD CONSTRAINT financeiro_titulo_baixas_estorno_self_ck
    CHECK (baixa_origem_id IS NULL OR baixa_origem_id IS DISTINCT FROM id);

CREATE UNIQUE INDEX idx_fin_titulo_baixas_estorno_unico
  ON public.financeiro_titulo_baixas (baixa_origem_id)
  WHERE tipo_movimento = 'estorno';

CREATE INDEX idx_fin_titulo_baixas_tipo_titulo
  ON public.financeiro_titulo_baixas (titulo_id, tipo_movimento, data_baixa, criado_em);

COMMENT ON COLUMN public.financeiro_titulo_baixas.tipo_movimento IS
  'baixa liquida principal do título; estorno é um novo movimento imutável que reverte uma baixa anterior.';
COMMENT ON COLUMN public.financeiro_titulo_baixas.baixa_origem_id IS
  'Obrigatório em estornos e aponta para a baixa original. A baixa original nunca é alterada nem excluída.';

CREATE OR REPLACE VIEW public.vw_financeiro_titulo_saldos
WITH (security_invoker = true)
AS
SELECT
  t.id AS titulo_id,
  t.valor_liquido,
  COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END), 0::numeric)::numeric(18,2) AS valor_baixado,
  GREATEST(
    t.valor_liquido - COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END), 0::numeric),
    0::numeric
  )::numeric(18,2) AS saldo_aberto,
  COALESCE(
    SUM(
      (CASE WHEN b.tipo_movimento = 'estorno' THEN -1 ELSE 1 END) *
      round(
        b.valor_principal
        - b.valor_desconto
        + b.valor_juros
        + b.valor_multa
        + b.valor_acrescimos
        - b.valor_retencoes,
        2
      )
    ),
    0::numeric
  )::numeric(18,2) AS valor_movimentado,
  GREATEST(
    COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -1 ELSE 1 END), 0),
    0
  )::integer AS qtd_baixas,
  MIN(b.data_baixa) FILTER (WHERE b.tipo_movimento = 'baixa') AS data_primeira_baixa,
  MAX(b.data_baixa) FILTER (WHERE b.tipo_movimento = 'baixa') AS data_ultima_baixa,
  CASE
    WHEN t.status = 'cancelado' THEN 'cancelado'
    WHEN COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END), 0::numeric) <= 0 THEN 'aberto'
    WHEN COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END), 0::numeric) >= t.valor_liquido THEN 'baixado'
    ELSE 'parcial'
  END AS status_calculado
FROM public.financeiro_titulos t
LEFT JOIN public.financeiro_titulo_baixas b ON b.titulo_id = t.id
GROUP BY t.id, t.valor_liquido, t.status;

REVOKE ALL ON public.vw_financeiro_titulo_saldos FROM anon;
GRANT SELECT ON public.vw_financeiro_titulo_saldos TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_validar_limite_baixas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo_id uuid := COALESCE(NEW.titulo_id, OLD.titulo_id);
  v_liquido numeric(18,2);
  v_baixado numeric(18,2);
BEGIN
  SELECT t.valor_liquido
    INTO v_liquido
  FROM public.financeiro_titulos t
  WHERE t.id = v_titulo_id;

  SELECT COALESCE(
    SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END),
    0
  )::numeric(18,2)
    INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = v_titulo_id;

  IF v_baixado < 0 THEN
    RAISE EXCEPTION 'Saldo liquidado do título não pode ser negativo';
  END IF;

  IF v_baixado > v_liquido THEN
    RAISE EXCEPTION 'Baixas líquidas (R$ %) excedem o valor líquido do título (R$ %)', v_baixado, v_liquido;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_validar_limite_baixas() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.fn_sync_status_titulo_baixas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo_id uuid := COALESCE(NEW.titulo_id, OLD.titulo_id);
  v_liquido numeric(18,2);
  v_baixado numeric(18,2);
  v_status text;
BEGIN
  SELECT t.valor_liquido, t.status
    INTO v_liquido, v_status
  FROM public.financeiro_titulos t
  WHERE t.id = v_titulo_id
  FOR UPDATE;

  IF v_status = 'cancelado' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(
    SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END),
    0
  )::numeric(18,2)
    INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = v_titulo_id;

  UPDATE public.financeiro_titulos
  SET status = CASE
    WHEN v_baixado <= 0 THEN 'aberto'
    WHEN v_baixado >= v_liquido THEN 'baixado'
    ELSE 'parcial'
  END,
  atualizado_em = now(),
  atualizado_por = auth.uid()
  WHERE id = v_titulo_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_sync_status_titulo_baixas() FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.fn_baixar_titulo_impl(
  p_titulo_id uuid,
  p_valor_principal numeric,
  p_data_baixa date,
  p_valor_desconto numeric DEFAULT 0,
  p_valor_juros numeric DEFAULT 0,
  p_valor_multa numeric DEFAULT 0,
  p_valor_acrescimos numeric DEFAULT 0,
  p_valor_retencoes numeric DEFAULT 0,
  p_observacao text DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL,
  p_referencia text DEFAULT NULL,
  p_origem_tipo text DEFAULT 'manual',
  p_origem_ref text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_baixa_id uuid := gen_random_uuid();
  v_liquido numeric(18,2);
  v_baixado numeric(18,2);
  v_saldo numeric(18,2);
  v_status text;
BEGIN
  IF NOT private.financeiro_pode_operar() THEN
    RAISE EXCEPTION 'Sem permissão para baixar título financeiro';
  END IF;

  IF p_titulo_id IS NULL THEN RAISE EXCEPTION 'Título é obrigatório'; END IF;
  IF p_data_baixa IS NULL THEN RAISE EXCEPTION 'Data da baixa é obrigatória'; END IF;
  IF p_valor_principal IS NULL OR round(p_valor_principal, 2) <= 0 THEN
    RAISE EXCEPTION 'Valor da baixa deve ser positivo';
  END IF;
  IF COALESCE(p_valor_desconto, 0) < 0 OR COALESCE(p_valor_juros, 0) < 0
     OR COALESCE(p_valor_multa, 0) < 0 OR COALESCE(p_valor_acrescimos, 0) < 0
     OR COALESCE(p_valor_retencoes, 0) < 0 THEN
    RAISE EXCEPTION 'Ajustes da baixa não podem ser negativos';
  END IF;

  SELECT t.valor_liquido, t.status
    INTO v_liquido, v_status
  FROM public.financeiro_titulos t
  WHERE t.id = p_titulo_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Título financeiro não encontrado'; END IF;
  IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Título cancelado não pode receber baixa'; END IF;

  SELECT COALESCE(
    SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END),
    0
  )::numeric(18,2)
    INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = p_titulo_id;

  v_saldo := round(v_liquido - v_baixado, 2);
  IF v_saldo <= 0 THEN RAISE EXCEPTION 'Título já está integralmente baixado'; END IF;
  IF round(p_valor_principal, 2) > v_saldo THEN
    RAISE EXCEPTION 'Valor da baixa (R$ %) excede o saldo em aberto (R$ %)', round(p_valor_principal, 2), v_saldo;
  END IF;

  INSERT INTO public.financeiro_titulo_baixas (
    id, titulo_id, data_baixa, valor_principal,
    valor_desconto, valor_juros, valor_multa, valor_acrescimos, valor_retencoes,
    forma_pagamento, referencia, observacao, origem_tipo, origem_ref,
    tipo_movimento, baixa_origem_id
  ) VALUES (
    v_baixa_id, p_titulo_id, p_data_baixa, round(p_valor_principal, 2),
    round(COALESCE(p_valor_desconto, 0), 2),
    round(COALESCE(p_valor_juros, 0), 2),
    round(COALESCE(p_valor_multa, 0), 2),
    round(COALESCE(p_valor_acrescimos, 0), 2),
    round(COALESCE(p_valor_retencoes, 0), 2),
    NULLIF(btrim(p_forma_pagamento), ''),
    NULLIF(btrim(p_referencia), ''),
    NULLIF(btrim(p_observacao), ''),
    COALESCE(NULLIF(btrim(p_origem_tipo), ''), 'manual'),
    NULLIF(btrim(p_origem_ref), ''),
    'baixa', NULL
  );

  RETURN v_baixa_id;
END;
$$;

REVOKE ALL ON FUNCTION private.fn_baixar_titulo_impl(
  uuid, numeric, date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_baixar_titulo_impl(
  uuid, numeric, date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_estornar_baixa_impl(
  p_baixa_id uuid,
  p_data_estorno date,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_original public.financeiro_titulo_baixas%ROWTYPE;
  v_estorno_id uuid := gen_random_uuid();
  v_status text;
BEGIN
  IF NOT private.financeiro_pode_operar() THEN
    RAISE EXCEPTION 'Sem permissão para estornar baixa financeira';
  END IF;

  IF p_baixa_id IS NULL THEN RAISE EXCEPTION 'Baixa é obrigatória'; END IF;
  IF p_data_estorno IS NULL THEN RAISE EXCEPTION 'Data do estorno é obrigatória'; END IF;

  SELECT * INTO v_original
  FROM public.financeiro_titulo_baixas
  WHERE id = p_baixa_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Baixa financeira não encontrada'; END IF;
  IF v_original.tipo_movimento <> 'baixa' THEN
    RAISE EXCEPTION 'Somente uma baixa original pode ser estornada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financeiro_titulo_baixas b
    WHERE b.baixa_origem_id = v_original.id
      AND b.tipo_movimento = 'estorno'
  ) THEN
    RAISE EXCEPTION 'Esta baixa já foi estornada';
  END IF;

  SELECT t.status INTO v_status
  FROM public.financeiro_titulos t
  WHERE t.id = v_original.titulo_id
  FOR UPDATE;

  IF v_status = 'cancelado' THEN
    RAISE EXCEPTION 'Título cancelado não pode receber estorno; reabra o título antes';
  END IF;

  INSERT INTO public.financeiro_titulo_baixas (
    id, titulo_id, data_baixa, valor_principal,
    valor_desconto, valor_juros, valor_multa, valor_acrescimos, valor_retencoes,
    forma_pagamento, referencia, observacao, origem_tipo, origem_ref,
    tipo_movimento, baixa_origem_id
  ) VALUES (
    v_estorno_id, v_original.titulo_id, p_data_estorno, v_original.valor_principal,
    v_original.valor_desconto, v_original.valor_juros, v_original.valor_multa,
    v_original.valor_acrescimos, v_original.valor_retencoes,
    v_original.forma_pagamento,
    'ESTORNO:' || v_original.id::text,
    NULLIF(btrim(p_observacao), ''),
    'estorno', v_original.id::text,
    'estorno', v_original.id
  );

  RETURN v_estorno_id;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_estornar_baixa_impl(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_estornar_baixa_impl(uuid, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_estornar_baixa(
  p_baixa_id uuid,
  p_data_estorno date,
  p_observacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.fn_estornar_baixa_impl(p_baixa_id, p_data_estorno, p_observacao);
$$;
REVOKE ALL ON FUNCTION public.fn_estornar_baixa(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_estornar_baixa(uuid, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_editar_titulo_manual_v2_impl(
  p_titulo_id uuid,
  p_natureza_tipo smallint,
  p_cnpj_cpf text,
  p_nome text,
  p_data_emissao date,
  p_data_vencimento date,
  p_historico text,
  p_rateios jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo text;
  v_total numeric(18,2) := 0;
  v_baixado numeric(18,2) := 0;
  v_status text;
  v_origem_tipo text;
  v_item jsonb;
  v_cod_natureza text;
  v_centro_custo text;
  v_valor numeric(18,2);
  v_obra_linha uuid;
  v_cc_principal text;
  v_obra_principal uuid;
  v_primeira_linha boolean := true;
BEGIN
  IF NOT private.financeiro_pode_operar() THEN
    RAISE EXCEPTION 'Sem permissão para editar título financeiro';
  END IF;

  IF p_natureza_tipo = 1 THEN v_tipo := 'receber';
  ELSIF p_natureza_tipo = 2 THEN v_tipo := 'pagar';
  ELSE RAISE EXCEPTION 'Tipo financeiro inválido: use 1 (receber) ou 2 (pagar)';
  END IF;

  IF p_data_vencimento IS NULL THEN RAISE EXCEPTION 'Data de vencimento é obrigatória'; END IF;
  IF p_rateios IS NULL OR jsonb_typeof(p_rateios) <> 'array' OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um rateio';
  END IF;

  SELECT t.status, t.origem_tipo INTO v_status, v_origem_tipo
  FROM public.financeiro_titulos t
  WHERE t.id = p_titulo_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Título financeiro não encontrado'; END IF;
  IF v_origem_tipo <> 'manual' THEN RAISE EXCEPTION 'Somente títulos manuais podem ser editados nesta operação'; END IF;
  IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Título cancelado deve ser reaberto antes da edição'; END IF;

  SELECT COALESCE(
    SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END),
    0
  )::numeric(18,2)
  INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = p_titulo_id;

  IF v_baixado <> 0 THEN
    RAISE EXCEPTION 'Título com baixa líquida ativa não pode ser editado; estorne as baixas antes';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    v_cod_natureza := NULLIF(btrim(v_item ->> 'cod_natureza'), '');
    v_centro_custo := NULLIF(btrim(v_item ->> 'centro_custo'), '');
    v_valor := NULLIF(v_item ->> 'valor_rateio', '')::numeric;

    IF v_cod_natureza IS NULL OR v_centro_custo IS NULL OR v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio inválido: natureza, centro de custo e valor positivo são obrigatórios';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.plano_contas pc
      WHERE pc.cod_natureza = v_cod_natureza AND pc.ativo IS NOT FALSE
    ) THEN
      RAISE EXCEPTION 'Natureza inexistente ou inativa: %', v_cod_natureza;
    END IF;

    SELECT cct.obra_id INTO v_obra_linha
    FROM public.centros_custo_totvs cct
    WHERE cct.codigo = v_centro_custo AND cct.ativo IS NOT FALSE
    LIMIT 1;

    IF NOT FOUND THEN RAISE EXCEPTION 'Centro de custo inexistente ou inativo: %', v_centro_custo; END IF;

    IF v_primeira_linha THEN
      v_cc_principal := v_centro_custo;
      v_obra_principal := v_obra_linha;
      v_primeira_linha := false;
    ELSIF v_cc_principal IS DISTINCT FROM v_centro_custo THEN
      v_cc_principal := NULL;
      v_obra_principal := NULL;
    END IF;

    v_total := v_total + round(v_valor, 2);
  END LOOP;

  v_total := round(v_total, 2);
  IF v_total <= 0 THEN RAISE EXCEPTION 'Valor total do título deve ser positivo'; END IF;

  UPDATE public.financeiro_titulos
  SET tipo = v_tipo,
      cnpj_cpf = NULLIF(btrim(p_cnpj_cpf), ''),
      nome = NULLIF(btrim(p_nome), ''),
      data_emissao = COALESCE(p_data_emissao, CURRENT_DATE),
      data_competencia = COALESCE(p_data_emissao, CURRENT_DATE),
      data_vencimento = p_data_vencimento,
      valor_original = v_total,
      valor_desconto = 0,
      valor_juros = 0,
      valor_multa = 0,
      valor_acrescimos = 0,
      valor_retencoes = 0,
      valor_liquido = v_total,
      centro_custo = v_cc_principal,
      obra_id = v_obra_principal,
      historico = NULLIF(btrim(p_historico), ''),
      atualizado_em = now(),
      atualizado_por = auth.uid()
  WHERE id = p_titulo_id;

  DELETE FROM public.financeiro_titulo_rateios WHERE titulo_id = p_titulo_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    v_cod_natureza := btrim(v_item ->> 'cod_natureza');
    v_centro_custo := btrim(v_item ->> 'centro_custo');
    v_valor := round((v_item ->> 'valor_rateio')::numeric, 2);

    SELECT cct.obra_id INTO v_obra_linha
    FROM public.centros_custo_totvs cct
    WHERE cct.codigo = v_centro_custo AND cct.ativo IS NOT FALSE
    LIMIT 1;

    INSERT INTO public.financeiro_titulo_rateios (
      titulo_id, cod_natureza, centro_custo, obra_id, valor
    ) VALUES (
      p_titulo_id, v_cod_natureza, v_centro_custo, v_obra_linha, v_valor
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_editar_titulo_manual_v2_impl(uuid, smallint, text, text, date, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_editar_titulo_manual_v2_impl(uuid, smallint, text, text, date, date, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_editar_titulo_manual_v2(
  p_titulo_id uuid,
  p_natureza_tipo smallint,
  p_cnpj_cpf text,
  p_nome text,
  p_data_emissao date,
  p_data_vencimento date,
  p_historico text,
  p_rateios jsonb
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.fn_editar_titulo_manual_v2_impl(
    p_titulo_id, p_natureza_tipo, p_cnpj_cpf, p_nome,
    p_data_emissao, p_data_vencimento, p_historico, p_rateios
  );
$$;
REVOKE ALL ON FUNCTION public.fn_editar_titulo_manual_v2(uuid, smallint, text, text, date, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_editar_titulo_manual_v2(uuid, smallint, text, text, date, date, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_cancelar_titulo_impl(p_titulo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_origem_tipo text;
  v_baixado numeric(18,2);
BEGIN
  IF NOT private.financeiro_pode_operar() THEN RAISE EXCEPTION 'Sem permissão para cancelar título financeiro'; END IF;

  SELECT t.status, t.origem_tipo INTO v_status, v_origem_tipo
  FROM public.financeiro_titulos t
  WHERE t.id = p_titulo_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Título financeiro não encontrado'; END IF;
  IF v_origem_tipo <> 'manual' THEN RAISE EXCEPTION 'Somente títulos manuais podem ser cancelados nesta operação'; END IF;
  IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Título já está cancelado'; END IF;

  SELECT COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END), 0)::numeric(18,2)
  INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = p_titulo_id;

  IF v_baixado <> 0 THEN RAISE EXCEPTION 'Título com baixa líquida ativa não pode ser cancelado; estorne as baixas antes'; END IF;

  UPDATE public.financeiro_titulos
  SET status = 'cancelado',
      cancelado_em = now(),
      cancelado_por = auth.uid(),
      atualizado_em = now(),
      atualizado_por = auth.uid()
  WHERE id = p_titulo_id;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_cancelar_titulo_impl(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_cancelar_titulo_impl(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_cancelar_titulo(p_titulo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.fn_cancelar_titulo_impl(p_titulo_id); $$;
REVOKE ALL ON FUNCTION public.fn_cancelar_titulo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_titulo(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_reabrir_titulo_impl(p_titulo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_origem_tipo text;
  v_baixado numeric(18,2);
BEGIN
  IF NOT private.financeiro_pode_operar() THEN RAISE EXCEPTION 'Sem permissão para reabrir título financeiro'; END IF;

  SELECT t.status, t.origem_tipo INTO v_status, v_origem_tipo
  FROM public.financeiro_titulos t
  WHERE t.id = p_titulo_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Título financeiro não encontrado'; END IF;
  IF v_origem_tipo <> 'manual' THEN RAISE EXCEPTION 'Somente títulos manuais podem ser reabertos nesta operação'; END IF;
  IF v_status <> 'cancelado' THEN RAISE EXCEPTION 'Somente título cancelado pode ser reaberto'; END IF;

  SELECT COALESCE(SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END), 0)::numeric(18,2)
  INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = p_titulo_id;

  IF v_baixado <> 0 THEN RAISE EXCEPTION 'Título cancelado possui baixa líquida ativa e não pode ser reaberto'; END IF;

  UPDATE public.financeiro_titulos
  SET status = 'aberto',
      cancelado_em = NULL,
      cancelado_por = NULL,
      atualizado_em = now(),
      atualizado_por = auth.uid()
  WHERE id = p_titulo_id;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_reabrir_titulo_impl(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_reabrir_titulo_impl(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_reabrir_titulo(p_titulo_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.fn_reabrir_titulo_impl(p_titulo_id); $$;
REVOKE ALL ON FUNCTION public.fn_reabrir_titulo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_reabrir_titulo(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_auditar_financeiro_canonico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo_id uuid;
  v_baixa_id uuid;
  v_entidade text;
  v_entidade_id uuid;
  v_evento text;
  v_ator_id uuid := auth.uid();
  v_ator_login text;
  v_origem text;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  IF v_ator_id IS NOT NULL THEN
    SELECT pr.login INTO v_ator_login
    FROM public.profiles pr
    WHERE pr.id = v_ator_id;
  END IF;

  v_origem := CASE WHEN v_ator_id IS NULL THEN 'sistema' ELSE 'app' END;

  IF TG_TABLE_NAME = 'financeiro_titulos' THEN
    v_titulo_id := COALESCE(NEW.id, OLD.id);
    v_entidade := 'titulo';
    v_entidade_id := v_titulo_id;
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_depois := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

    IF TG_OP = 'INSERT' THEN
      v_evento := 'titulo_criado';
    ELSIF TG_OP = 'DELETE' THEN
      v_evento := 'titulo_excluido';
    ELSIF OLD.status IS DISTINCT FROM NEW.status
       AND (to_jsonb(OLD) - 'status' - 'atualizado_em' - 'atualizado_por' - 'cancelado_em' - 'cancelado_por')
         = (to_jsonb(NEW) - 'status' - 'atualizado_em' - 'atualizado_por' - 'cancelado_em' - 'cancelado_por') THEN
      v_evento := CASE WHEN NEW.status = 'cancelado' THEN 'titulo_cancelado' ELSE 'titulo_reaberto' END;
    ELSIF (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por')
          = (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por') THEN
      RETURN NEW;
    ELSE
      v_evento := 'titulo_alterado';
    END IF;

  ELSIF TG_TABLE_NAME = 'financeiro_titulo_rateios' THEN
    v_titulo_id := COALESCE(NEW.titulo_id, OLD.titulo_id);
    v_entidade := 'rateio';
    v_entidade_id := COALESCE(NEW.id, OLD.id);
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_depois := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_evento := CASE TG_OP
      WHEN 'INSERT' THEN 'rateio_criado'
      WHEN 'UPDATE' THEN 'rateio_alterado'
      ELSE 'rateio_removido'
    END;

  ELSIF TG_TABLE_NAME = 'financeiro_titulo_baixas' THEN
    v_titulo_id := NEW.titulo_id;
    v_baixa_id := NEW.id;
    v_entidade := 'baixa';
    v_entidade_id := NEW.id;
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
    v_evento := CASE WHEN NEW.tipo_movimento = 'estorno' THEN 'baixa_estornada' ELSE 'baixa_registrada' END;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.financeiro_titulo_eventos (
    titulo_id, baixa_id, entidade, entidade_id, evento,
    ator_id, ator_login, origem, dados_antes, dados_depois,
    metadata
  ) VALUES (
    v_titulo_id, v_baixa_id, v_entidade, v_entidade_id, v_evento,
    v_ator_id, v_ator_login, v_origem, v_antes, v_depois,
    jsonb_build_object('operacao_sql', TG_OP, 'tabela', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_auditar_financeiro_canonico() FROM PUBLIC;