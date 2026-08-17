-- Revisão GO da Etapa 1: fecha escrita direta, garante idempotência externa
-- e coerência matemática do valor líquido no núcleo canônico.

-- Enquanto o ciclo de vida operacional ainda não possui RPCs próprias,
-- clientes autenticados ficam somente-leitura nas tabelas canônicas.
REVOKE INSERT, UPDATE, DELETE ON public.financeiro_titulos FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.financeiro_titulo_rateios FROM authenticated;
GRANT SELECT ON public.financeiro_titulos TO authenticated;
GRANT SELECT ON public.financeiro_titulo_rateios TO authenticated;

DROP POLICY IF EXISTS financeiro_titulos_insert ON public.financeiro_titulos;
DROP POLICY IF EXISTS financeiro_titulos_update ON public.financeiro_titulos;
DROP POLICY IF EXISTS financeiro_titulo_rateios_insert ON public.financeiro_titulo_rateios;
DROP POLICY IF EXISTS financeiro_titulo_rateios_update ON public.financeiro_titulo_rateios;
DROP POLICY IF EXISTS financeiro_titulo_rateios_delete ON public.financeiro_titulo_rateios;

-- origem_ref é a chave idempotente na fonte. Quando a fonte não possuir uma
-- chave global, ela deve ser namespaced pelo adaptador (ex.: "coligada:IDLAN").
DROP INDEX IF EXISTS public.idx_fin_titulos_origem;
CREATE INDEX idx_fin_titulos_origem
  ON public.financeiro_titulos (origem_tipo, origem_ref);
CREATE UNIQUE INDEX idx_fin_titulos_origem_ref_unique
  ON public.financeiro_titulos (origem_tipo, origem_ref)
  WHERE origem_ref IS NOT NULL;

COMMENT ON COLUMN public.financeiro_titulos.origem_ref IS
  'Chave idempotente estável na origem externa. Deve ser namespaced quando a fonte não for globalmente única.';

ALTER TABLE public.financeiro_titulos
  ADD CONSTRAINT financeiro_titulos_valor_liquido_formula_ck
  CHECK (
    valor_liquido = round(
      valor_original
      - valor_desconto
      + valor_juros
      + valor_multa
      + valor_acrescimos
      - valor_retencoes,
      2
    )
  );
