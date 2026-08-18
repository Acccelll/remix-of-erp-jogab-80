-- ETAPA 2 — Rateios: Natureza × Centro de Custo × Obra com integridade transacional.
--
-- Fecha o modelo operacional de rateios sem alterar o legado TOTVS. Cada linha
-- passa a carregar explicitamente a classificação analítica e o banco garante,
-- no COMMIT, que a soma efetiva dos rateios fecha com o valor líquido do título.

ALTER TABLE public.financeiro_titulo_rateios
  ALTER COLUMN centro_custo SET NOT NULL;

ALTER TABLE public.financeiro_titulo_rateios
  DROP CONSTRAINT IF EXISTS financeiro_titulo_rateios_base_ck;

ALTER TABLE public.financeiro_titulo_rateios
  ADD CONSTRAINT financeiro_titulo_rateios_base_ck
  CHECK (
    (valor IS NOT NULL AND percentual IS NULL)
    OR (valor IS NULL AND percentual IS NOT NULL)
  ),
  ADD CONSTRAINT financeiro_titulo_rateios_centro_custo_ck
  CHECK (length(btrim(centro_custo)) > 0);

COMMENT ON COLUMN public.financeiro_titulo_rateios.centro_custo IS
  'Centro de custo analítico da linha. A obra é derivada/validada pelo cadastro centros_custo_totvs quando houver vínculo.';
COMMENT ON COLUMN public.financeiro_titulo_rateios.percentual IS
  'Alternativa ao valor absoluto. Exatamente um entre valor e percentual deve ser informado.';

CREATE OR REPLACE FUNCTION private.fn_validar_rateios_titulo(p_titulo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_valor_liquido numeric(18,2);
  v_qtd integer;
  v_total numeric(18,2);
BEGIN
  SELECT t.valor_liquido
    INTO v_valor_liquido
  FROM public.financeiro_titulos t
  WHERE t.id = p_titulo_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    count(*),
    COALESCE(
      round(
        sum(
          CASE
            WHEN r.valor IS NOT NULL THEN r.valor
            ELSE round(v_valor_liquido * r.percentual / 100.0, 2)
          END
        ),
        2
      ),
      0
    )
    INTO v_qtd, v_total
  FROM public.financeiro_titulo_rateios r
  WHERE r.titulo_id = p_titulo_id;

  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Título financeiro deve possuir ao menos um rateio';
  END IF;

  IF v_total <> round(v_valor_liquido, 2) THEN
    RAISE EXCEPTION 'Rateios do título não fecham com o valor líquido: rateado %, título %',
      v_total, round(v_valor_liquido, 2);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_titulo_rateios r
    LEFT JOIN public.centros_custo_totvs cct
      ON cct.codigo = r.centro_custo
     AND cct.ativo IS NOT FALSE
    WHERE r.titulo_id = p_titulo_id
      AND cct.codigo IS NULL
  ) THEN
    RAISE EXCEPTION 'Rateio possui centro de custo inexistente ou inativo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_titulo_rateios r
    JOIN public.centros_custo_totvs cct
      ON cct.codigo = r.centro_custo
     AND cct.ativo IS NOT FALSE
    WHERE r.titulo_id = p_titulo_id
      AND r.obra_id IS DISTINCT FROM cct.obra_id
  ) THEN
    RAISE EXCEPTION 'Obra do rateio não corresponde ao centro de custo selecionado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_titulo_rateios r
    WHERE r.titulo_id = p_titulo_id
    GROUP BY r.cod_natureza, r.centro_custo, r.obra_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Rateio duplicado para a mesma Natureza × Centro de Custo × Obra';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.fn_validar_rateios_titulo(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.trg_validar_rateios_titulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'financeiro_titulos' THEN
    v_id := COALESCE(NEW.id, OLD.id);
    PERFORM private.fn_validar_rateios_titulo(v_id);
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.titulo_id IS DISTINCT FROM NEW.titulo_id THEN
    PERFORM private.fn_validar_rateios_titulo(OLD.titulo_id);
  END IF;

  v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.titulo_id ELSE NEW.titulo_id END;
  PERFORM private.fn_validar_rateios_titulo(v_id);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.trg_validar_rateios_titulo() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_fin_titulo_rateios_integridade ON public.financeiro_titulo_rateios;
CREATE CONSTRAINT TRIGGER trg_fin_titulo_rateios_integridade
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_titulo_rateios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION private.trg_validar_rateios_titulo();

DROP TRIGGER IF EXISTS trg_fin_titulo_rateios_valor_titulo ON public.financeiro_titulos;
CREATE CONSTRAINT TRIGGER trg_fin_titulo_rateios_valor_titulo
AFTER INSERT OR UPDATE ON public.financeiro_titulos
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION private.trg_validar_rateios_titulo();

CREATE OR REPLACE FUNCTION private.fn_criar_titulo_manual_v2_impl(
  p_natureza_tipo smallint,
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
  IF auth.uid() IS NULL OR NOT (
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

  IF p_rateios IS NULL OR jsonb_typeof(p_rateios) <> 'array' OR jsonb_array_length(p_rateios) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um rateio';
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
    RAISE EXCEPTION 'Valor total do título deve ser positivo';
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
    'MANUAL', 'MAN-' || upper(substr(replace(v_id::text, '-', ''), 1, 12)),
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

REVOKE ALL ON FUNCTION private.fn_criar_titulo_manual_v2_impl(
  smallint, text, text, date, date, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.fn_criar_titulo_manual_v2_impl(
  smallint, text, text, date, date, text, jsonb
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_criar_titulo_manual_v2(
  p_natureza_tipo smallint,
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
  SELECT private.fn_criar_titulo_manual_v2_impl(
    p_natureza_tipo,
    p_cnpj_cpf,
    p_nome,
    p_data_emissao,
    p_data_vencimento,
    p_historico,
    p_rateios
  );
$$;

REVOKE ALL ON FUNCTION public.fn_criar_titulo_manual_v2(
  smallint, text, text, date, date, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_criar_titulo_manual_v2(
  smallint, text, text, date, date, text, jsonb
) TO authenticated, service_role;
