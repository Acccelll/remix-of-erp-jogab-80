-- Ajustes pre-Etapa 8: identificacao documental obrigatoria nos titulos manuais.

ALTER TABLE public.financeiro_titulos
  DROP CONSTRAINT IF EXISTS financeiro_titulos_manual_documento_ck;

ALTER TABLE public.financeiro_titulos
  ADD CONSTRAINT financeiro_titulos_manual_documento_ck
  CHECK (
    origem_tipo <> 'manual'
    OR (
      NULLIF(btrim(tipo_documento), '') IS NOT NULL
      AND NULLIF(btrim(numero_documento), '') IS NOT NULL
    )
  );

COMMENT ON CONSTRAINT financeiro_titulos_manual_documento_ck ON public.financeiro_titulos IS
  'Titulos criados manualmente no ERP devem informar Tipo de Documento e Documento, equivalentes a TIPO_DOCUMENTO e DOCUMENTO do TOTVS.';

CREATE OR REPLACE FUNCTION private.fn_criar_titulo_manual_v3_impl(
  p_natureza_tipo smallint,
  p_tipo_documento text,
  p_numero_documento text,
  p_cnpj_cpf text,
  p_nome text,
  p_data_emissao date,
  p_data_vencimento date,
  p_historico text,
  p_rateios jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_tipo text;
  v_total numeric(18,2) := 0;
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
    RAISE EXCEPTION 'Sem permissao para criar titulo financeiro';
  END IF;

  IF p_natureza_tipo = 1 THEN
    v_tipo := 'receber';
  ELSIF p_natureza_tipo = 2 THEN
    v_tipo := 'pagar';
  ELSE
    RAISE EXCEPTION 'Tipo financeiro invalido: use 1 (receber) ou 2 (pagar)';
  END IF;

  IF NULLIF(btrim(p_tipo_documento), '') IS NULL THEN
    RAISE EXCEPTION 'Tipo de Documento e obrigatorio';
  END IF;

  IF NULLIF(btrim(p_numero_documento), '') IS NULL THEN
    RAISE EXCEPTION 'Documento e obrigatorio';
  END IF;

  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'Data de vencimento e obrigatoria';
  END IF;

  IF p_rateios IS NULL OR jsonb_typeof(p_rateios) <> 'array' OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um rateio';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    v_cod_natureza := NULLIF(btrim(v_item ->> 'cod_natureza'), '');
    v_centro_custo := NULLIF(btrim(v_item ->> 'centro_custo'), '');
    v_valor := NULLIF(v_item ->> 'valor_rateio', '')::numeric;

    IF v_cod_natureza IS NULL OR v_centro_custo IS NULL OR v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio invalido: natureza, centro de custo e valor positivo sao obrigatorios';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.plano_contas pc
      WHERE pc.cod_natureza = v_cod_natureza
        AND pc.ativo IS NOT FALSE
    ) THEN
      RAISE EXCEPTION 'Natureza inexistente ou inativa: %', v_cod_natureza;
    END IF;

    SELECT cct.obra_id
      INTO v_obra_linha
    FROM public.centros_custo_totvs cct
    WHERE cct.codigo = v_centro_custo
      AND cct.ativo IS NOT FALSE
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Centro de custo inexistente ou inativo: %', v_centro_custo;
    END IF;

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
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Valor total do titulo deve ser positivo';
  END IF;

  INSERT INTO public.financeiro_titulos (
    id, tipo, cnpj_cpf, nome,
    tipo_documento, numero_documento,
    data_emissao, data_competencia, data_vencimento,
    valor_original, valor_liquido,
    centro_custo, obra_id, historico,
    origem_tipo, status
  ) VALUES (
    v_id, v_tipo, NULLIF(btrim(p_cnpj_cpf), ''), NULLIF(btrim(p_nome), ''),
    btrim(p_tipo_documento), btrim(p_numero_documento),
    COALESCE(p_data_emissao, CURRENT_DATE), COALESCE(p_data_emissao, CURRENT_DATE), p_data_vencimento,
    v_total, v_total,
    v_cc_principal, v_obra_principal, NULLIF(btrim(p_historico), ''),
    'manual', 'aberto'
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    v_cod_natureza := btrim(v_item ->> 'cod_natureza');
    v_centro_custo := btrim(v_item ->> 'centro_custo');
    v_valor := round((v_item ->> 'valor_rateio')::numeric, 2);

    SELECT cct.obra_id
      INTO v_obra_linha
    FROM public.centros_custo_totvs cct
    WHERE cct.codigo = v_centro_custo
      AND cct.ativo IS NOT FALSE
    LIMIT 1;

    INSERT INTO public.financeiro_titulo_rateios (
      titulo_id, cod_natureza, centro_custo, obra_id, valor
    ) VALUES (
      v_id, v_cod_natureza, v_centro_custo, v_obra_linha, v_valor
    );
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.fn_criar_titulo_manual_v3_impl(
  smallint, text, text, text, text, date, date, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_criar_titulo_manual_v3_impl(
  smallint, text, text, text, text, date, date, text, jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_criar_titulo_manual_v3(
  p_natureza_tipo smallint,
  p_tipo_documento text,
  p_numero_documento text,
  p_cnpj_cpf text,
  p_nome text,
  p_data_emissao date,
  p_data_vencimento date,
  p_historico text,
  p_rateios jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.fn_criar_titulo_manual_v3_impl(
    p_natureza_tipo,
    p_tipo_documento,
    p_numero_documento,
    p_cnpj_cpf,
    p_nome,
    p_data_emissao,
    p_data_vencimento,
    p_historico,
    p_rateios
  );
$$;

REVOKE ALL ON FUNCTION public.fn_criar_titulo_manual_v3(
  smallint, text, text, text, text, date, date, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_criar_titulo_manual_v3(
  smallint, text, text, text, text, date, date, text, jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fn_editar_titulo_manual_v3_impl(
  p_titulo_id uuid,
  p_natureza_tipo smallint,
  p_tipo_documento text,
  p_numero_documento text,
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
    RAISE EXCEPTION 'Sem permissao para editar titulo financeiro';
  END IF;

  IF p_natureza_tipo = 1 THEN v_tipo := 'receber';
  ELSIF p_natureza_tipo = 2 THEN v_tipo := 'pagar';
  ELSE RAISE EXCEPTION 'Tipo financeiro invalido: use 1 (receber) ou 2 (pagar)';
  END IF;

  IF NULLIF(btrim(p_tipo_documento), '') IS NULL THEN
    RAISE EXCEPTION 'Tipo de Documento e obrigatorio';
  END IF;

  IF NULLIF(btrim(p_numero_documento), '') IS NULL THEN
    RAISE EXCEPTION 'Documento e obrigatorio';
  END IF;

  IF p_data_vencimento IS NULL THEN RAISE EXCEPTION 'Data de vencimento e obrigatoria'; END IF;
  IF p_rateios IS NULL OR jsonb_typeof(p_rateios) <> 'array' OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um rateio';
  END IF;

  SELECT t.status, t.origem_tipo INTO v_status, v_origem_tipo
  FROM public.financeiro_titulos t
  WHERE t.id = p_titulo_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Titulo financeiro nao encontrado'; END IF;
  IF v_origem_tipo <> 'manual' THEN RAISE EXCEPTION 'Somente titulos manuais podem ser editados nesta operacao'; END IF;
  IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Titulo cancelado deve ser reaberto antes da edicao'; END IF;

  SELECT COALESCE(
    SUM(CASE WHEN b.tipo_movimento = 'estorno' THEN -b.valor_principal ELSE b.valor_principal END),
    0
  )::numeric(18,2)
  INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = p_titulo_id;

  IF v_baixado <> 0 THEN
    RAISE EXCEPTION 'Titulo com baixa liquida ativa nao pode ser editado; estorne as baixas antes';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    v_cod_natureza := NULLIF(btrim(v_item ->> 'cod_natureza'), '');
    v_centro_custo := NULLIF(btrim(v_item ->> 'centro_custo'), '');
    v_valor := NULLIF(v_item ->> 'valor_rateio', '')::numeric;

    IF v_cod_natureza IS NULL OR v_centro_custo IS NULL OR v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio invalido: natureza, centro de custo e valor positivo sao obrigatorios';
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
  IF v_total <= 0 THEN RAISE EXCEPTION 'Valor total do titulo deve ser positivo'; END IF;

  UPDATE public.financeiro_titulos
  SET tipo = v_tipo,
      cnpj_cpf = NULLIF(btrim(p_cnpj_cpf), ''),
      nome = NULLIF(btrim(p_nome), ''),
      tipo_documento = btrim(p_tipo_documento),
      numero_documento = btrim(p_numero_documento),
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

REVOKE ALL ON FUNCTION private.fn_editar_titulo_manual_v3_impl(
  uuid, smallint, text, text, text, text, date, date, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_editar_titulo_manual_v3_impl(
  uuid, smallint, text, text, text, text, date, date, text, jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_editar_titulo_manual_v3(
  p_titulo_id uuid,
  p_natureza_tipo smallint,
  p_tipo_documento text,
  p_numero_documento text,
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
  SELECT private.fn_editar_titulo_manual_v3_impl(
    p_titulo_id,
    p_natureza_tipo,
    p_tipo_documento,
    p_numero_documento,
    p_cnpj_cpf,
    p_nome,
    p_data_emissao,
    p_data_vencimento,
    p_historico,
    p_rateios
  );
$$;

REVOKE ALL ON FUNCTION public.fn_editar_titulo_manual_v3(
  uuid, smallint, text, text, text, text, date, date, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_editar_titulo_manual_v3(
  uuid, smallint, text, text, text, text, date, date, text, jsonb
) TO authenticated, service_role;
