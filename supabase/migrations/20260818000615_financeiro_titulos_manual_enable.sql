-- FIN-003 — Habilitação definitiva da criação manual no núcleo canônico.
-- A FIN-002 já tornou financeiro_titulos visível em vw_financeiro_obra; portanto
-- o guard temporário pode ser removido sem voltar a gravar no legado/TOTVS.

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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_tipo text;
  v_total numeric(18,2);
  v_obra_id uuid;
  v_empresa_id uuid;
  v_item jsonb;
  v_cod_natureza text;
  v_valor numeric(18,2);
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR public.has_role(auth.uid(), 'gm'::public.app_role)
    OR private.current_player_has_access('financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar título financeiro';
  END IF;

  IF p_natureza_tipo = 1 THEN
    v_tipo := 'receber';
  ELSIF p_natureza_tipo = 2 THEN
    v_tipo := 'pagar';
  ELSE
    RAISE EXCEPTION 'Tipo financeiro inválido: use 1 (receber) ou 2 (pagar)';
  END IF;

  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'Data de vencimento é obrigatória';
  END IF;

  IF p_centro_custo IS NULL OR btrim(p_centro_custo) = '' THEN
    RAISE EXCEPTION 'Centro de custo é obrigatório';
  END IF;

  IF p_rateios IS NULL OR jsonb_typeof(p_rateios) <> 'array' OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um rateio';
  END IF;

  v_total := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    v_cod_natureza := NULLIF(btrim(v_item ->> 'cod_natureza'), '');
    v_valor := NULLIF(v_item ->> 'valor_rateio', '')::numeric;

    IF v_cod_natureza IS NULL OR v_valor IS NULL OR v_valor <= 0 THEN
      RAISE EXCEPTION 'Rateio inválido: natureza e valor positivo são obrigatórios';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.plano_contas pc
      WHERE pc.cod_natureza = v_cod_natureza
        AND pc.ativo IS NOT FALSE
    ) THEN
      RAISE EXCEPTION 'Natureza inexistente ou inativa: %', v_cod_natureza;
    END IF;

    v_total := v_total + v_valor;
  END LOOP;

  v_total := round(v_total, 2);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Valor total do título deve ser positivo';
  END IF;

  SELECT cct.obra_id, o.empresa_id
    INTO v_obra_id, v_empresa_id
  FROM public.centros_custo_totvs cct
  LEFT JOIN public.obras o ON o.id = cct.obra_id
  WHERE cct.codigo = p_centro_custo
  ORDER BY cct.ativo DESC, cct.updated_at DESC
  LIMIT 1;

  INSERT INTO public.financeiro_titulos (
    id, tipo, empresa_id, cnpj_cpf, nome,
    tipo_documento, numero_documento,
    data_emissao, data_competencia, data_vencimento,
    valor_original, valor_liquido,
    centro_custo, obra_id, historico,
    origem_tipo, status
  ) VALUES (
    v_id, v_tipo, v_empresa_id, NULLIF(btrim(p_cnpj_cpf), ''), NULLIF(btrim(p_nome), ''),
    'MANUAL', 'MAN-' || upper(substr(replace(v_id::text, '-', ''), 1, 12)),
    COALESCE(p_data_emissao, CURRENT_DATE), COALESCE(p_data_emissao, CURRENT_DATE), p_data_vencimento,
    v_total, v_total,
    p_centro_custo, v_obra_id, NULLIF(btrim(p_historico), ''),
    'manual', 'aberto'
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_rateios)
  LOOP
    INSERT INTO public.financeiro_titulo_rateios (
      titulo_id, cod_natureza, centro_custo, obra_id, valor
    ) VALUES (
      v_id,
      btrim(v_item ->> 'cod_natureza'),
      p_centro_custo,
      v_obra_id,
      round((v_item ->> 'valor_rateio')::numeric, 2)
    );
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_criar_titulo_manual(
  smallint, text, text, text, date, date, text, jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_criar_titulo_manual(
  smallint, text, text, text, date, date, text, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.fn_criar_titulo_manual(
  smallint, text, text, text, date, date, text, jsonb
) TO service_role;
