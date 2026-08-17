-- ETAPA 1 — Núcleo operacional canônico de títulos financeiros.
--
-- O legado de snapshots/importações TOTVS permanece intocado. Títulos criados
-- pelo ERP passam a ter identidade própria (UUID) e não dependem de IDLAN ou
-- snapshot_id. O desenho é deliberadamente portável para futura migração MySQL.

-- ---------------------------------------------------------------------------
-- Títulos operacionais
-- ---------------------------------------------------------------------------
CREATE TABLE public.financeiro_titulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tipo text NOT NULL,
  empresa_id uuid NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  filial integer NULL,

  -- contraparte_id fica sem FK nesta fase: o cadastro canônico de
  -- cliente/fornecedor ainda será consolidado.
  contraparte_id uuid NULL,
  cnpj_cpf text NULL,
  nome text NULL,
  nome_fantasia text NULL,

  tipo_documento text NULL,
  numero_documento text NULL,
  serie_documento text NULL,
  parcela_numero integer NULL,
  parcela_total integer NULL,

  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_competencia date NULL,
  data_vencimento date NOT NULL,
  data_previsao_baixa date NULL,

  valor_original numeric(18,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(18,2) NOT NULL DEFAULT 0,
  valor_juros numeric(18,2) NOT NULL DEFAULT 0,
  valor_multa numeric(18,2) NOT NULL DEFAULT 0,
  valor_acrescimos numeric(18,2) NOT NULL DEFAULT 0,
  valor_retencoes numeric(18,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(18,2) NOT NULL DEFAULT 0,

  -- Classificação principal/fallback. O rateio 1:N é a classificação analítica.
  centro_custo text NULL,
  obra_id uuid NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  historico text NULL,
  observacao text NULL,

  -- Referência externa desacoplada da PK interna. Ex.: origem_tipo='totvs',
  -- origem_ref='<IDLAN>' quando a consolidação de legados for feita futuramente.
  origem_tipo text NOT NULL,
  origem_id uuid NULL,
  origem_item_id uuid NULL,
  origem_ref text NULL,

  status text NOT NULL DEFAULT 'aberto',

  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NULL DEFAULT auth.uid(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL DEFAULT auth.uid(),
  cancelado_em timestamptz NULL,
  cancelado_por uuid NULL,

  CONSTRAINT financeiro_titulos_tipo_ck
    CHECK (tipo IN ('pagar', 'receber')),
  CONSTRAINT financeiro_titulos_status_ck
    CHECK (status IN ('aberto', 'parcial', 'baixado', 'cancelado')),
  CONSTRAINT financeiro_titulos_filial_ck
    CHECK (filial IS NULL OR filial >= 0),
  CONSTRAINT financeiro_titulos_origem_ck
    CHECK (length(btrim(origem_tipo)) > 0),
  CONSTRAINT financeiro_titulos_parcela_ck
    CHECK (
      (parcela_numero IS NULL AND parcela_total IS NULL)
      OR (
        parcela_numero IS NOT NULL
        AND parcela_total IS NOT NULL
        AND parcela_numero > 0
        AND parcela_total > 0
        AND parcela_total >= parcela_numero
      )
    ),
  CONSTRAINT financeiro_titulos_valores_ck
    CHECK (
      valor_original > 0
      AND valor_desconto >= 0
      AND valor_juros >= 0
      AND valor_multa >= 0
      AND valor_acrescimos >= 0
      AND valor_retencoes >= 0
      AND valor_liquido >= 0
    )
);

COMMENT ON TABLE public.financeiro_titulos IS
  'Fonte canônica dos títulos operacionais do ERP. Independente de snapshots TOTVS.';
COMMENT ON COLUMN public.financeiro_titulos.origem_ref IS
  'Identificador na origem externa (ex.: IDLAN), nunca usado como PK interna.';

CREATE INDEX idx_fin_titulos_status_vencimento
  ON public.financeiro_titulos (status, data_vencimento);
CREATE INDEX idx_fin_titulos_tipo_vencimento
  ON public.financeiro_titulos (tipo, data_vencimento);
CREATE INDEX idx_fin_titulos_cnpj_cpf
  ON public.financeiro_titulos (cnpj_cpf)
  WHERE cnpj_cpf IS NOT NULL;
CREATE INDEX idx_fin_titulos_obra
  ON public.financeiro_titulos (obra_id)
  WHERE obra_id IS NOT NULL;
CREATE INDEX idx_fin_titulos_origem
  ON public.financeiro_titulos (origem_tipo, origem_ref);
CREATE INDEX idx_fin_titulos_empresa_filial
  ON public.financeiro_titulos (empresa_id, filial)
  WHERE empresa_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Rateios operacionais
-- ---------------------------------------------------------------------------
CREATE TABLE public.financeiro_titulo_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL
    REFERENCES public.financeiro_titulos(id) ON DELETE CASCADE,
  cod_natureza text NOT NULL
    REFERENCES public.plano_contas(cod_natureza) ON UPDATE CASCADE ON DELETE RESTRICT,
  centro_custo text NULL,
  obra_id uuid NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  valor numeric(18,2) NULL,
  percentual numeric(9,6) NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NULL DEFAULT auth.uid(),

  CONSTRAINT financeiro_titulo_rateios_valor_ck
    CHECK (valor IS NULL OR valor > 0),
  CONSTRAINT financeiro_titulo_rateios_percentual_ck
    CHECK (percentual IS NULL OR (percentual > 0 AND percentual <= 100)),
  CONSTRAINT financeiro_titulo_rateios_base_ck
    CHECK (valor IS NOT NULL OR percentual IS NOT NULL)
);

COMMENT ON TABLE public.financeiro_titulo_rateios IS
  'Rateio analítico do título por natureza, centro de custo e obra.';

CREATE INDEX idx_fin_titulo_rateios_titulo
  ON public.financeiro_titulo_rateios (titulo_id);
CREATE INDEX idx_fin_titulo_rateios_natureza
  ON public.financeiro_titulo_rateios (cod_natureza);
CREATE INDEX idx_fin_titulo_rateios_obra
  ON public.financeiro_titulo_rateios (obra_id)
  WHERE obra_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Auditoria mínima de atualização
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_financeiro_titulo_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.atualizado_em := now();
  NEW.atualizado_por := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_financeiro_titulo_touch
BEFORE UPDATE ON public.financeiro_titulos
FOR EACH ROW
EXECUTE FUNCTION public.fn_financeiro_titulo_touch();

REVOKE ALL ON FUNCTION public.fn_financeiro_titulo_touch() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- RLS: somente Financeiro/GM ou usuário com acesso modular ao Financeiro.
-- Não existe policy DELETE em financeiro_titulos: cancelamento é mudança de
-- estado, não exclusão física.
-- ---------------------------------------------------------------------------
ALTER TABLE public.financeiro_titulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_titulo_rateios ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.financeiro_titulos FROM anon;
REVOKE ALL ON public.financeiro_titulo_rateios FROM anon;
REVOKE ALL ON public.financeiro_titulos FROM authenticated;
REVOKE ALL ON public.financeiro_titulo_rateios FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.financeiro_titulos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_titulo_rateios TO authenticated;
GRANT ALL ON public.financeiro_titulos TO service_role;
GRANT ALL ON public.financeiro_titulo_rateios TO service_role;

CREATE POLICY financeiro_titulos_select
ON public.financeiro_titulos
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE POLICY financeiro_titulos_insert
ON public.financeiro_titulos
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE POLICY financeiro_titulos_update
ON public.financeiro_titulos
FOR UPDATE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
)
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE POLICY financeiro_titulo_rateios_select
ON public.financeiro_titulo_rateios
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE POLICY financeiro_titulo_rateios_insert
ON public.financeiro_titulo_rateios
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE POLICY financeiro_titulo_rateios_update
ON public.financeiro_titulo_rateios
FOR UPDATE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
)
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE POLICY financeiro_titulo_rateios_delete
ON public.financeiro_titulo_rateios
FOR DELETE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

-- ---------------------------------------------------------------------------
-- Compatibilidade temporária com o formulário atual de "Novo título".
-- A RPC mantém a assinatura usada pelo front, porém agora grava SOMENTE no
-- núcleo canônico. Não toca snapshots, financeiro_lancamentos nem Matriz TOTVS.
-- ---------------------------------------------------------------------------
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
      SELECT 1 FROM public.plano_contas pc
      WHERE pc.cod_natureza = v_cod_natureza AND pc.ativo IS NOT FALSE
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
