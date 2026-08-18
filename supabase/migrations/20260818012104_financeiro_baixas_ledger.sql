-- ETAPA 3 — Ledger canônico de baixas 1:N e saldo derivado.
-- O legado TOTVS permanece somente leitura e não é alterado.

CREATE TABLE public.financeiro_titulo_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo_id uuid NOT NULL REFERENCES public.financeiro_titulos(id) ON DELETE RESTRICT,
  data_baixa date NOT NULL,
  valor_principal numeric(18,2) NOT NULL,
  valor_desconto numeric(18,2) NOT NULL DEFAULT 0,
  valor_juros numeric(18,2) NOT NULL DEFAULT 0,
  valor_multa numeric(18,2) NOT NULL DEFAULT 0,
  valor_acrescimos numeric(18,2) NOT NULL DEFAULT 0,
  valor_retencoes numeric(18,2) NOT NULL DEFAULT 0,
  forma_pagamento text NULL,
  referencia text NULL,
  observacao text NULL,
  origem_tipo text NOT NULL DEFAULT 'manual',
  origem_ref text NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid NULL DEFAULT auth.uid(),
  CONSTRAINT financeiro_titulo_baixas_principal_ck CHECK (valor_principal > 0),
  CONSTRAINT financeiro_titulo_baixas_ajustes_ck CHECK (
    valor_desconto >= 0
    AND valor_juros >= 0
    AND valor_multa >= 0
    AND valor_acrescimos >= 0
    AND valor_retencoes >= 0
  ),
  CONSTRAINT financeiro_titulo_baixas_fluxo_ck CHECK (
    round(
      valor_principal
      - valor_desconto
      + valor_juros
      + valor_multa
      + valor_acrescimos
      - valor_retencoes,
      2
    ) >= 0
  ),
  CONSTRAINT financeiro_titulo_baixas_origem_ck CHECK (length(btrim(origem_tipo)) > 0)
);

COMMENT ON TABLE public.financeiro_titulo_baixas IS
  'Ledger imutável de pagamentos/recebimentos do título canônico. Cada linha representa uma baixa; saldo é derivado pela soma de valor_principal.';
COMMENT ON COLUMN public.financeiro_titulo_baixas.valor_principal IS
  'Parcela do valor líquido do título liquidada nesta baixa. É este valor que reduz o saldo em aberto.';
COMMENT ON COLUMN public.financeiro_titulo_baixas.valor_desconto IS
  'Desconto financeiro concedido/obtido nesta baixa; reduz o valor efetivamente movimentado, não o principal liquidado.';
COMMENT ON COLUMN public.financeiro_titulo_baixas.valor_retencoes IS
  'Retenções da baixa; reduzem o valor efetivamente movimentado, sem reduzir o principal liquidado além de valor_principal.';

CREATE INDEX idx_fin_titulo_baixas_titulo_data
  ON public.financeiro_titulo_baixas (titulo_id, data_baixa, criado_em);
CREATE UNIQUE INDEX idx_fin_titulo_baixas_origem_unique
  ON public.financeiro_titulo_baixas (origem_tipo, origem_ref)
  WHERE origem_ref IS NOT NULL;

ALTER TABLE public.financeiro_titulo_baixas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_titulo_baixas FROM anon;
REVOKE ALL ON public.financeiro_titulo_baixas FROM authenticated;
GRANT SELECT ON public.financeiro_titulo_baixas TO authenticated;
GRANT ALL ON public.financeiro_titulo_baixas TO service_role;

CREATE POLICY financeiro_titulo_baixas_select
ON public.financeiro_titulo_baixas
FOR SELECT TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'financeiro'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'gm'::public.app_role)
  OR private.current_player_has_access('financeiro')
);

CREATE OR REPLACE VIEW public.vw_financeiro_titulo_saldos
WITH (security_invoker = true)
AS
SELECT
  t.id AS titulo_id,
  t.valor_liquido,
  COALESCE(SUM(b.valor_principal), 0::numeric)::numeric(18,2) AS valor_baixado,
  GREATEST(t.valor_liquido - COALESCE(SUM(b.valor_principal), 0::numeric), 0::numeric)::numeric(18,2) AS saldo_aberto,
  COALESCE(
    SUM(
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
  COUNT(b.id)::integer AS qtd_baixas,
  MIN(b.data_baixa) AS data_primeira_baixa,
  MAX(b.data_baixa) AS data_ultima_baixa,
  CASE
    WHEN t.status = 'cancelado' THEN 'cancelado'
    WHEN COALESCE(SUM(b.valor_principal), 0::numeric) <= 0 THEN 'aberto'
    WHEN COALESCE(SUM(b.valor_principal), 0::numeric) >= t.valor_liquido THEN 'baixado'
    ELSE 'parcial'
  END AS status_calculado
FROM public.financeiro_titulos t
LEFT JOIN public.financeiro_titulo_baixas b ON b.titulo_id = t.id
GROUP BY t.id, t.valor_liquido, t.status;

REVOKE ALL ON public.vw_financeiro_titulo_saldos FROM anon;
GRANT SELECT ON public.vw_financeiro_titulo_saldos TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_financeiro_titulo_fatias
WITH (security_invoker = true)
AS
WITH base AS (
  SELECT
    t.id AS titulo_id,
    tr.id AS rateio_id,
    COALESCE(tr.obra_id, t.obra_id) AS obra_id,
    COALESCE(tr.centro_custo, t.centro_custo) AS centro_custo,
    CASE
      WHEN tr.id IS NULL THEN t.valor_liquido
      WHEN tr.valor IS NOT NULL THEN tr.valor
      WHEN tr.percentual IS NOT NULL THEN round(t.valor_liquido * tr.percentual / 100.0, 2)
      ELSE 0::numeric
    END AS valor_rateio
  FROM public.financeiro_titulos t
  LEFT JOIN public.financeiro_titulo_rateios tr ON tr.titulo_id = t.id
), agrupado AS (
  SELECT
    titulo_id,
    obra_id,
    centro_custo,
    COUNT(rateio_id) AS qtd_rateios,
    SUM(valor_rateio)::numeric(18,2) AS valor_fatia
  FROM base
  GROUP BY titulo_id, obra_id, centro_custo
)
SELECT
  a.titulo_id,
  CASE
    WHEN a.qtd_rateios = 0 THEN a.titulo_id
    ELSE (
      substr(md5(a.titulo_id::text || '|' || COALESCE(a.obra_id::text, '') || '|' || COALESCE(a.centro_custo, '')), 1, 8) || '-' ||
      substr(md5(a.titulo_id::text || '|' || COALESCE(a.obra_id::text, '') || '|' || COALESCE(a.centro_custo, '')), 9, 4) || '-' ||
      substr(md5(a.titulo_id::text || '|' || COALESCE(a.obra_id::text, '') || '|' || COALESCE(a.centro_custo, '')), 13, 4) || '-' ||
      substr(md5(a.titulo_id::text || '|' || COALESCE(a.obra_id::text, '') || '|' || COALESCE(a.centro_custo, '')), 17, 4) || '-' ||
      substr(md5(a.titulo_id::text || '|' || COALESCE(a.obra_id::text, '') || '|' || COALESCE(a.centro_custo, '')), 21, 12)
    )::uuid
  END AS lancamento_id,
  a.obra_id,
  a.centro_custo,
  a.valor_fatia
FROM agrupado a;

REVOKE ALL ON public.vw_financeiro_titulo_fatias FROM anon;
GRANT SELECT ON public.vw_financeiro_titulo_fatias TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_financeiro_obra_operacional
WITH (security_invoker = true)
AS
SELECT
  v.lancamento_id,
  f.titulo_id,
  v.obra_id,
  v.obra_nome,
  v.obra_codigo,
  v.natureza_tipo,
  CASE
    WHEN f.titulo_id IS NULL THEN v.status_cod
    WHEN s.status_calculado = 'cancelado' THEN 18::smallint
    WHEN s.status_calculado = 'baixado' THEN 3::smallint
    WHEN s.status_calculado = 'parcial' THEN 15::smallint
    WHEN v.data_vencimento = CURRENT_DATE THEN 29::smallint
    WHEN v.data_vencimento < CURRENT_DATE THEN 40::smallint
    ELSE 56::smallint
  END AS status_cod,
  CASE
    WHEN f.titulo_id IS NULL THEN v.status_label
    WHEN s.status_calculado = 'cancelado' THEN 'Cancelado'
    WHEN s.status_calculado = 'baixado' THEN 'Baixado'
    WHEN s.status_calculado = 'parcial' THEN 'Baixado - Parcial'
    WHEN v.data_vencimento = CURRENT_DATE THEN 'Vence Hoje'
    WHEN v.data_vencimento < CURRENT_DATE THEN 'Vencido'
    ELSE 'A Vencer'
  END AS status_label,
  v.grupo,
  v.subgrupo,
  v.cod_natureza,
  v.desc_natureza,
  v.valor_liquido,
  CASE
    WHEN f.titulo_id IS NULL THEN v.valor_baixado
    WHEN s.valor_liquido <= 0 THEN 0::numeric
    WHEN s.status_calculado = 'baixado' THEN v.valor_liquido
    ELSE LEAST(
      v.valor_liquido,
      round(v.valor_liquido * s.valor_baixado / NULLIF(s.valor_liquido, 0), 2)
    )
  END::numeric(18,2) AS valor_baixado,
  v.valor_rateio,
  v.mes_competencia,
  v.data_vencimento,
  CASE
    WHEN f.titulo_id IS NULL THEN v.data_pagamento
    ELSE s.data_ultima_baixa
  END AS data_pagamento,
  v.data_emissao,
  v.contraparte,
  v.cnpj_cpf,
  v.historico,
  v.ref_lancamento,
  v.centro_custo,
  v.desc_centro_custo,
  v.centro_custo_tipo,
  v.categoria_indireta,
  v.origem,
  s.valor_liquido::numeric(18,2) AS titulo_valor_liquido,
  s.valor_baixado::numeric(18,2) AS titulo_valor_baixado,
  s.saldo_aberto::numeric(18,2) AS titulo_saldo_aberto,
  s.qtd_baixas,
  s.valor_movimentado::numeric(18,2) AS titulo_valor_movimentado
FROM public.vw_financeiro_obra v
LEFT JOIN public.vw_financeiro_titulo_fatias f ON f.lancamento_id = v.lancamento_id
LEFT JOIN public.vw_financeiro_titulo_saldos s ON s.titulo_id = f.titulo_id;

REVOKE ALL ON public.vw_financeiro_obra_operacional FROM anon;
GRANT SELECT ON public.vw_financeiro_obra_operacional TO authenticated, service_role;

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

  SELECT COALESCE(SUM(b.valor_principal), 0)::numeric(18,2)
    INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = v_titulo_id;

  IF v_baixado > v_liquido THEN
    RAISE EXCEPTION 'Baixas (R$ %) excedem o valor líquido do título (R$ %)', v_baixado, v_liquido;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_validar_limite_baixas() FROM PUBLIC;

CREATE CONSTRAINT TRIGGER trg_fin_titulo_baixas_limite
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_titulo_baixas
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION private.fn_validar_limite_baixas();

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

  SELECT COALESCE(SUM(b.valor_principal), 0)::numeric(18,2)
    INTO v_baixado
  FROM public.financeiro_titulo_baixas b
  WHERE b.titulo_id = v_titulo_id;

  UPDATE public.financeiro_titulos
  SET status = CASE
    WHEN v_baixado <= 0 THEN 'aberto'
    WHEN v_baixado >= v_liquido THEN 'baixado'
    ELSE 'parcial'
  END
  WHERE id = v_titulo_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.fn_sync_status_titulo_baixas() FROM PUBLIC;

CREATE TRIGGER trg_fin_titulo_baixas_sync_status
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_titulo_baixas
FOR EACH ROW EXECUTE FUNCTION private.fn_sync_status_titulo_baixas();

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
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR public.has_role(auth.uid(), 'gm'::public.app_role)
    OR private.current_player_has_access('financeiro')
  ) THEN
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

  SELECT COALESCE(SUM(b.valor_principal), 0)::numeric(18,2)
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
    forma_pagamento, referencia, observacao, origem_tipo, origem_ref
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
    NULLIF(btrim(p_origem_ref), '')
  );

  RETURN v_baixa_id;
END;
$$;

REVOKE ALL ON FUNCTION private.fn_baixar_titulo_impl(
  uuid, numeric, date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text
) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.fn_baixar_titulo_impl(
  uuid, numeric, date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_baixar_titulo(
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.fn_baixar_titulo_impl(
    p_titulo_id, p_valor_principal, p_data_baixa,
    p_valor_desconto, p_valor_juros, p_valor_multa, p_valor_acrescimos, p_valor_retencoes,
    p_observacao, p_forma_pagamento, p_referencia, p_origem_tipo, p_origem_ref
  );
$$;

REVOKE ALL ON FUNCTION public.fn_baixar_titulo(
  uuid, numeric, date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_baixar_titulo(
  uuid, numeric, date, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text
) TO authenticated, service_role;
