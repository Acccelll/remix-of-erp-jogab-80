-- Título manual (3/3): sequence de ref_lancamento reservada para lançamentos
-- manuais (fora da faixa de IDLAN real do TOTVS) e as RPCs de ciclo de vida
-- do título manual: criar, editar, dar baixa (total/parcial) e cancelar.
-- Mesma tabela/mesma view usadas pelos títulos TOTVS (financeiro_lancamentos +
-- financeiro_matriz_rateios + vw_financeiro_obra) — só a origem muda.

CREATE SEQUENCE IF NOT EXISTS public.fin_manual_ref_seq
  START WITH 900000000000
  INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.fn_criar_titulo_manual(
  p_natureza_tipo smallint,
  p_centro_custo text,
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
SET search_path = public
AS $$
DECLARE
  v_ref bigint;
  v_valor numeric;
  v_snap_id uuid;
  v_lanc_id uuid;
  v_desc_ccusto text;
  v_obra_id uuid;
  v_cc_tipo text;
  v_cc_categoria text;
  v_status smallint;
BEGIN
  IF NOT public.fn_importar_matriz_pode() THEN
    RAISE EXCEPTION 'Usuário sem permissão para lançar títulos manuais.' USING ERRCODE = '42501';
  END IF;

  IF p_natureza_tipo NOT IN (1, 2) THEN
    RAISE EXCEPTION 'natureza_tipo deve ser 1 (a receber) ou 2 (a pagar).';
  END IF;
  IF p_centro_custo IS NULL OR btrim(p_centro_custo) = '' THEN
    RAISE EXCEPTION 'Centro de custo é obrigatório.';
  END IF;
  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'Data de vencimento é obrigatória.';
  END IF;
  IF p_rateios IS NULL OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma linha de rateio por natureza.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rateios) e WHERE NULLIF(e->>'cod_natureza', '') IS NULL) THEN
    RAISE EXCEPTION 'Toda linha de rateio precisa de uma natureza (cod_natureza).';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rateios) e WHERE COALESCE((e->>'valor_rateio')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'Toda linha de rateio precisa de um valor maior que zero.';
  END IF;

  SELECT descricao, obra_id, tipo, categoria
    INTO v_desc_ccusto, v_obra_id, v_cc_tipo, v_cc_categoria
  FROM public.centros_custo_totvs
  WHERE codigo = p_centro_custo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Centro de custo % não cadastrado.', p_centro_custo;
  END IF;

  SELECT COALESCE(SUM((e->>'valor_rateio')::numeric), 0) INTO v_valor
  FROM jsonb_array_elements(p_rateios) e;
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'A soma do rateio deve ser maior que zero.';
  END IF;

  v_ref := nextval('public.fin_manual_ref_seq');
  v_status := public.fn_financeiro_status_matriz(NULL, p_data_vencimento, CURRENT_DATE);

  SELECT id INTO v_snap_id FROM public.financeiro_snapshots ORDER BY importado_em DESC LIMIT 1;
  IF v_snap_id IS NULL THEN
    INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
    VALUES ('sistema', 'sistema') RETURNING id INTO v_snap_id;
  END IF;

  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, centro_custo, desc_centro_custo, obra_id,
    natureza_tipo, status_cod, status_label, tipo_documento, numero_documento,
    cnpj_cpf, nome, cliente_fornecedor, valor_original, valor_liquido, valor_baixado,
    data_emissao, data_vencimento, historico, centro_custo_tipo, categoria_indireta,
    origem, pendente_natureza
  ) VALUES (
    v_snap_id, v_ref, p_centro_custo, v_desc_ccusto, v_obra_id,
    p_natureza_tipo, v_status, public.fn_financeiro_status_label(v_status),
    'MANUAL', 'MAN-' || v_ref::text,
    p_cnpj_cpf, p_nome, p_nome, v_valor, v_valor, 0,
    p_data_emissao, p_data_vencimento, p_historico, COALESCE(v_cc_tipo, 'nao_classificado'), v_cc_categoria,
    'manual', false
  ) RETURNING id INTO v_lanc_id;

  INSERT INTO public.financeiro_matriz_rateios (
    ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original,
    data_emissao, data_vencimento, natureza_tipo_matriz, valor_liquido, origem
  )
  SELECT
    v_ref, x.cod_nat, COALESCE(pc.descricao, NULLIF(e->>'desc_natureza', '')),
    COALESCE(pc.grupo, split_part(x.cod_nat, '.', 1)),
    COALESCE(pc.subgrupo, split_part(x.cod_nat, '.', 1)),
    p_centro_custo, v_desc_ccusto,
    (e->>'valor_rateio')::numeric, (e->>'valor_rateio')::numeric,
    p_data_emissao, p_data_vencimento, p_natureza_tipo, v_valor, 'manual'
  FROM jsonb_array_elements(p_rateios) e,
    LATERAL (SELECT NULLIF(e->>'cod_natureza', '') AS cod_nat) x
  LEFT JOIN public.plano_contas pc ON pc.cod_natureza = x.cod_nat;

  RETURN v_lanc_id;
END
$$;

CREATE OR REPLACE FUNCTION public.fn_editar_titulo_manual(
  p_ref_lancamento bigint,
  p_natureza_tipo smallint,
  p_centro_custo text,
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
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status_atual smallint;
  v_valor_baixado_atual numeric;
  v_valor numeric;
  v_desc_ccusto text;
  v_obra_id uuid;
  v_cc_tipo text;
  v_cc_categoria text;
  v_status smallint;
BEGIN
  IF NOT public.fn_importar_matriz_pode() THEN
    RAISE EXCEPTION 'Usuário sem permissão para editar títulos manuais.' USING ERRCODE = '42501';
  END IF;

  SELECT id, status_cod, valor_baixado
    INTO v_id, v_status_atual, v_valor_baixado_atual
  FROM public.financeiro_lancamentos
  WHERE ref_lancamento = p_ref_lancamento AND origem = 'manual'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título manual % não encontrado.', p_ref_lancamento;
  END IF;
  IF v_status_atual = 3 THEN
    RAISE EXCEPTION 'Título já baixado integralmente não pode ser editado.';
  END IF;
  IF v_status_atual = 18 THEN
    RAISE EXCEPTION 'Título cancelado não pode ser editado.';
  END IF;

  IF p_natureza_tipo NOT IN (1, 2) THEN
    RAISE EXCEPTION 'natureza_tipo deve ser 1 (a receber) ou 2 (a pagar).';
  END IF;
  IF p_centro_custo IS NULL OR btrim(p_centro_custo) = '' THEN
    RAISE EXCEPTION 'Centro de custo é obrigatório.';
  END IF;
  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'Data de vencimento é obrigatória.';
  END IF;
  IF p_rateios IS NULL OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma linha de rateio por natureza.';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rateios) e WHERE NULLIF(e->>'cod_natureza', '') IS NULL) THEN
    RAISE EXCEPTION 'Toda linha de rateio precisa de uma natureza (cod_natureza).';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rateios) e WHERE COALESCE((e->>'valor_rateio')::numeric, 0) <= 0) THEN
    RAISE EXCEPTION 'Toda linha de rateio precisa de um valor maior que zero.';
  END IF;

  SELECT descricao, obra_id, tipo, categoria
    INTO v_desc_ccusto, v_obra_id, v_cc_tipo, v_cc_categoria
  FROM public.centros_custo_totvs
  WHERE codigo = p_centro_custo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Centro de custo % não cadastrado.', p_centro_custo;
  END IF;

  SELECT COALESCE(SUM((e->>'valor_rateio')::numeric), 0) INTO v_valor
  FROM jsonb_array_elements(p_rateios) e;
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'A soma do rateio deve ser maior que zero.';
  END IF;
  IF v_status_atual = 15 AND v_valor < v_valor_baixado_atual THEN
    RAISE EXCEPTION 'Novo valor do título (%) é menor que o valor já baixado (%).', v_valor, v_valor_baixado_atual;
  END IF;

  v_status := CASE
    WHEN v_status_atual = 15 THEN 15
    ELSE public.fn_financeiro_status_matriz(NULL, p_data_vencimento, CURRENT_DATE)
  END;

  UPDATE public.financeiro_lancamentos SET
    centro_custo = p_centro_custo, desc_centro_custo = v_desc_ccusto, obra_id = v_obra_id,
    natureza_tipo = p_natureza_tipo, status_cod = v_status,
    status_label = public.fn_financeiro_status_label(v_status),
    cnpj_cpf = p_cnpj_cpf, nome = p_nome, cliente_fornecedor = p_nome,
    valor_original = v_valor, valor_liquido = v_valor,
    data_emissao = p_data_emissao, data_vencimento = p_data_vencimento, historico = p_historico,
    centro_custo_tipo = COALESCE(v_cc_tipo, 'nao_classificado'), categoria_indireta = v_cc_categoria
  WHERE id = v_id;

  DELETE FROM public.financeiro_matriz_rateios WHERE ref_lancamento = p_ref_lancamento AND origem = 'manual';

  INSERT INTO public.financeiro_matriz_rateios (
    ref_lancamento, cod_natureza, desc_natureza, grupo, subgrupo,
    cod_ccusto, desc_ccusto, valor_rateio, valor_original,
    data_emissao, data_vencimento, natureza_tipo_matriz, valor_liquido, origem
  )
  SELECT
    p_ref_lancamento, x.cod_nat, COALESCE(pc.descricao, NULLIF(e->>'desc_natureza', '')),
    COALESCE(pc.grupo, split_part(x.cod_nat, '.', 1)),
    COALESCE(pc.subgrupo, split_part(x.cod_nat, '.', 1)),
    p_centro_custo, v_desc_ccusto,
    (e->>'valor_rateio')::numeric, (e->>'valor_rateio')::numeric,
    p_data_emissao, p_data_vencimento, p_natureza_tipo, v_valor, 'manual'
  FROM jsonb_array_elements(p_rateios) e,
    LATERAL (SELECT NULLIF(e->>'cod_natureza', '') AS cod_nat) x
  LEFT JOIN public.plano_contas pc ON pc.cod_natureza = x.cod_nat;
END
$$;

CREATE OR REPLACE FUNCTION public.fn_baixar_titulo_manual(
  p_ref_lancamento bigint,
  p_valor_baixa numeric,
  p_data_baixa date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status_atual smallint;
  v_valor_liquido numeric;
  v_valor_baixado numeric;
  v_novo_baixado numeric;
  v_novo_status smallint;
BEGIN
  IF NOT public.fn_importar_matriz_pode() THEN
    RAISE EXCEPTION 'Usuário sem permissão para dar baixa em títulos manuais.' USING ERRCODE = '42501';
  END IF;
  IF p_valor_baixa IS NULL OR p_valor_baixa <= 0 THEN
    RAISE EXCEPTION 'Valor de baixa deve ser maior que zero.';
  END IF;
  IF p_data_baixa IS NULL THEN
    RAISE EXCEPTION 'Data de baixa é obrigatória.';
  END IF;

  SELECT id, status_cod, valor_liquido, valor_baixado
    INTO v_id, v_status_atual, v_valor_liquido, v_valor_baixado
  FROM public.financeiro_lancamentos
  WHERE ref_lancamento = p_ref_lancamento AND origem = 'manual'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título manual % não encontrado.', p_ref_lancamento;
  END IF;
  IF v_status_atual IN (3, 18) THEN
    RAISE EXCEPTION 'Título já baixado integralmente ou cancelado — não pode receber nova baixa.';
  END IF;

  v_novo_baixado := round(COALESCE(v_valor_baixado, 0) + p_valor_baixa, 2);
  IF v_novo_baixado > v_valor_liquido + 0.01 THEN
    RAISE EXCEPTION 'Valor de baixa (%) excede o saldo em aberto (%).',
      p_valor_baixa, round(v_valor_liquido - COALESCE(v_valor_baixado, 0), 2);
  END IF;
  v_novo_status := CASE WHEN v_novo_baixado >= v_valor_liquido - 0.01 THEN 3 ELSE 15 END;

  UPDATE public.financeiro_lancamentos SET
    valor_baixado = LEAST(v_novo_baixado, v_valor_liquido),
    status_cod = v_novo_status,
    status_label = public.fn_financeiro_status_label(v_novo_status),
    data_baixa = p_data_baixa,
    data_pagamento = p_data_baixa
  WHERE id = v_id;
END
$$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_titulo_manual(p_ref_lancamento bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status_atual smallint;
BEGIN
  IF NOT public.fn_importar_matriz_pode() THEN
    RAISE EXCEPTION 'Usuário sem permissão para cancelar títulos manuais.' USING ERRCODE = '42501';
  END IF;

  SELECT id, status_cod INTO v_id, v_status_atual
  FROM public.financeiro_lancamentos
  WHERE ref_lancamento = p_ref_lancamento AND origem = 'manual'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Título manual % não encontrado.', p_ref_lancamento;
  END IF;
  IF v_status_atual = 3 THEN
    RAISE EXCEPTION 'Título já baixado integralmente não pode ser cancelado.';
  END IF;
  IF v_status_atual = 18 THEN
    RAISE EXCEPTION 'Título já está cancelado.';
  END IF;

  UPDATE public.financeiro_lancamentos SET
    status_cod = 18, status_label = public.fn_financeiro_status_label(18)
  WHERE id = v_id;
END
$$;

REVOKE ALL ON FUNCTION public.fn_criar_titulo_manual(smallint, text, text, text, date, date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_criar_titulo_manual(smallint, text, text, text, date, date, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_editar_titulo_manual(bigint, smallint, text, text, text, date, date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_editar_titulo_manual(bigint, smallint, text, text, text, date, date, text, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_baixar_titulo_manual(bigint, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_baixar_titulo_manual(bigint, numeric, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_cancelar_titulo_manual(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_titulo_manual(bigint) TO authenticated, service_role;
