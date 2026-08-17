-- Guard temporário da UI legada de "Novo título".
--
-- O núcleo canônico já existe, porém os títulos de financeiro_titulos ainda
-- não fazem parte da visão consolidada consumida pela tela Financeiro. Até a
-- etapa de UI/consolidação, impedir criação pela RPC legada evita persistir um
-- título válido que ficaria invisível ao operador logo após salvar.

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
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR public.has_role(auth.uid(), 'gm'::public.app_role)
    OR private.current_player_has_access('financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar título financeiro';
  END IF;

  RAISE EXCEPTION 'Lançamento manual temporariamente indisponível enquanto a nova visão de títulos é integrada ao Financeiro.';
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
