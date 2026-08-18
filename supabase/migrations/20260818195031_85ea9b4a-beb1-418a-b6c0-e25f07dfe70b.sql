-- Corrige `fn_lancamento_solicitacao_aprovada`: o parâmetro `p_solicitacao_id`
-- era `uuid`, mas o id real de uma solicitação hoje é numérico (Aprovação
-- Financeira roda em MySQL via api.php — ver docs/db/CANONICIDADE.md). Toda
-- chamada real dessa RPC (feita em AprovacaoFinanceira.tsx ao aprovar) sempre
-- falhava com `invalid input syntax for type uuid`, engolida por um
-- try/catch que só loga aviso — a "previsão" da solicitação aprovada nunca
-- era criada em financeiro_lancamentos/Fluxo de Dívidas, apesar da RPC ser
-- chamada normalmente e nenhum erro aparecer para o usuário.
--
-- Mesma correção já aplicada à Fase 5 (CNAB) para
-- financeiro_previsao_carrinho_itens.solicitacao_id: troca de uuid para
-- text. Não há FK real entre bancos possível aqui — id de MySQL não é uuid.

DROP FUNCTION IF EXISTS public.fn_lancamento_solicitacao_aprovada(uuid, uuid, text, numeric, date, text);

-- financeiro_lancamentos.solicitacao_id tinha uma FK para a tabela Postgres
-- solicitacoes_financeiras (vestigial — ver docs/db/CANONICIDADE.md), que
-- nunca fazia sentido para ids reais (MySQL). Remove a FK antes de mudar o
-- tipo da coluna; procura o nome do constraint dinamicamente em vez de supor
-- o nome autogerado, já que a tabela passou por múltiplas recriações.
DO $$
DECLARE con text;
BEGIN
  SELECT conname INTO con
  FROM pg_constraint
  WHERE conrelid = 'public.financeiro_lancamentos'::regclass
    AND confrelid = 'public.solicitacoes_financeiras'::regclass
    AND contype = 'f';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.financeiro_lancamentos DROP CONSTRAINT %I', con);
  END IF;
END $$;

ALTER TABLE public.financeiro_lancamentos
  ALTER COLUMN solicitacao_id TYPE text USING solicitacao_id::text;

CREATE FUNCTION public.fn_lancamento_solicitacao_aprovada(
  p_solicitacao_id text, p_obra_id uuid, p_centro_custo text,
  p_valor numeric, p_data_prevista date, p_descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_snap_id UUID; v_lanc_id UUID;
BEGIN
  SELECT id INTO v_snap_id FROM public.financeiro_snapshots
   ORDER BY importado_em DESC LIMIT 1;
  IF v_snap_id IS NULL THEN
    INSERT INTO public.financeiro_snapshots (periodo_ref, nome_arquivo_titulos)
    VALUES ('sistema', 'sistema') RETURNING id INTO v_snap_id;
  END IF;
  INSERT INTO public.financeiro_lancamentos (
    snapshot_id, ref_lancamento, obra_id, centro_custo,
    valor_liquido, valor_original, data_vencimento,
    natureza_tipo, status_cod, status_label, historico, origem, solicitacao_id
  ) VALUES (
    v_snap_id, (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
    p_obra_id, p_centro_custo, p_valor, p_valor, p_data_prevista,
    2::smallint, 1, 'Compromisso (solicitação aprovada)',
    COALESCE(p_descricao, 'Solicitação aprovada'), 'sistema', p_solicitacao_id
  ) RETURNING id INTO v_lanc_id;
  RETURN v_lanc_id;
END $$;

REVOKE ALL ON FUNCTION public.fn_lancamento_solicitacao_aprovada(text, uuid, text, numeric, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_lancamento_solicitacao_aprovada(text, uuid, text, numeric, date, text) TO authenticated, service_role;

-- Congela a tabela Postgres solicitacoes_financeiras (fechamento §9.3 do
-- plano de design): a Aprovação Financeira real roda 100% em MySQL via
-- api.php desde antes desta migration. Confirmado por grep que nenhum
-- caminho do frontend faz INSERT/UPDATE nesta tabela — o único uso restante
-- é leitura (financeiro.ts:listCarrinhoSolicitacoesAoVivo), que continua
-- funcionando normalmente com as policies de SELECT já existentes.
DROP POLICY IF EXISTS "solfin_insert_autor_atual" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_update_financeiro_gm" ON public.solicitacoes_financeiras;
DROP POLICY IF EXISTS "solfin_delete" ON public.solicitacoes_financeiras;
REVOKE INSERT, UPDATE, DELETE ON public.solicitacoes_financeiras FROM authenticated, anon;
