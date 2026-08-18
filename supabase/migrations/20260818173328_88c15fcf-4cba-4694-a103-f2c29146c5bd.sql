-- Fase 5 (evolução de Financeiro): CNAB 240 — remessa, retorno e conciliação.
--
-- Pré-requisito corrigido nesta mesma migration (decisão do usuário — "Corrigir
-- dentro da Fase 5"): `financeiro_previsao_carrinho_itens.solicitacao_id` era
-- `uuid`, mas a Aprovação Financeira real roda hoje via api.php/MySQL (ids
-- numéricos) — gravar um id numérico nessa coluna sempre falhava com
-- `invalid input syntax for type uuid` (ver comentário em
-- src/lib/repositories/financeiro.ts:940-942, função listCarrinhoSolicitacoesAoVivo,
-- que hoje filtra silenciosamente qualquer id fora do formato UUID). Não há FK
-- declarada nessa coluna — é uma referência solta por design (padrão já usado
-- em outras integrações cross-DB do projeto) — então o troca de tipo é segura.

DROP INDEX IF EXISTS public.financeiro_previsao_carrinho_itens_solicitacao_uidx;

ALTER TABLE public.financeiro_previsao_carrinho_itens
  ALTER COLUMN solicitacao_id TYPE text USING solicitacao_id::text;

ALTER TABLE public.financeiro_previsao_carrinho_fechado_itens
  ALTER COLUMN solicitacao_id TYPE text USING solicitacao_id::text;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_previsao_carrinho_itens_solicitacao_uidx
  ON public.financeiro_previsao_carrinho_itens (carrinho_id, solicitacao_id)
  WHERE solicitacao_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Dados bancários do favorecido (fornecedor) — necessários para montar o
-- Segmento A de crédito em conta corrente.
-- ---------------------------------------------------------------------------
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS banco_codigo text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS agencia_dv text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS conta_dv text,
  ADD COLUMN IF NOT EXISTS tipo_conta text CHECK (tipo_conta IN ('corrente', 'poupanca')),
  ADD COLUMN IF NOT EXISTS chave_pix text;

-- ---------------------------------------------------------------------------
-- Conta bancária da empresa (pagadora) — usada para montar header/trailer.
-- ---------------------------------------------------------------------------
CREATE TABLE public.contas_bancarias_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco_codigo text NOT NULL,
  banco_nome text NOT NULL,
  agencia text NOT NULL,
  agencia_dv text,
  conta text NOT NULL,
  conta_dv text,
  convenio text NOT NULL,
  carteira text,
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  proximo_numero_arquivo integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS touch_contas_bancarias_empresa ON public.contas_bancarias_empresa;
CREATE TRIGGER touch_contas_bancarias_empresa BEFORE UPDATE ON public.contas_bancarias_empresa
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Remessa: cabeçalho + itens (snapshot dos dados do favorecido no momento do
-- envio — se o cadastro do fornecedor mudar depois, a remessa já gerada não
-- muda retroativamente).
-- ---------------------------------------------------------------------------
CREATE TABLE public.cnab_remessas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id uuid NOT NULL REFERENCES public.contas_bancarias_empresa(id) ON DELETE RESTRICT,
  carrinho_id uuid NOT NULL REFERENCES public.financeiro_previsao_carrinho(id) ON DELETE RESTRICT,
  layout text NOT NULL DEFAULT '240' CHECK (layout IN ('240', '400')),
  numero_arquivo integer NOT NULL,
  arquivo_path text,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'gerada', 'processada', 'erro')),
  gerada_em timestamptz NOT NULL DEFAULT now(),
  gerada_por uuid DEFAULT auth.uid(),
  UNIQUE (conta_bancaria_id, numero_arquivo)
);
CREATE INDEX idx_cnab_remessas_carrinho ON public.cnab_remessas(carrinho_id);
CREATE INDEX idx_cnab_remessas_conta ON public.cnab_remessas(conta_bancaria_id);

CREATE TABLE public.cnab_remessa_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id uuid NOT NULL REFERENCES public.cnab_remessas(id) ON DELETE CASCADE,
  -- Mesmo par origem_tipo/origem_id já usado no carrinho (ref_lancamento do
  -- TOTVS vs. solicitacao_id da aprovação financeira) — sem inventar um
  -- terceiro modelo de referência.
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('ref_lancamento', 'solicitacao')),
  origem_id text NOT NULL,
  favorecido_nome text NOT NULL,
  favorecido_documento text NOT NULL,
  favorecido_banco text NOT NULL,
  favorecido_agencia text NOT NULL,
  favorecido_agencia_dv text,
  favorecido_conta text NOT NULL,
  favorecido_conta_dv text,
  valor numeric(14,2) NOT NULL,
  nosso_numero text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cnab_remessa_itens_remessa ON public.cnab_remessa_itens(remessa_id);
CREATE INDEX idx_cnab_remessa_itens_origem ON public.cnab_remessa_itens(origem_tipo, origem_id);

CREATE SEQUENCE IF NOT EXISTS public.cnab_nosso_numero_seq START 1;

-- ---------------------------------------------------------------------------
-- Retorno: cabeçalho + ocorrências.
-- ---------------------------------------------------------------------------
CREATE TABLE public.cnab_retornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_path text NOT NULL,
  banco_codigo text NOT NULL,
  status text NOT NULL DEFAULT 'processado' CHECK (status IN ('processado', 'com_erros')),
  importado_em timestamptz NOT NULL DEFAULT now(),
  importado_por uuid DEFAULT auth.uid()
);

CREATE TABLE public.cnab_retorno_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retorno_id uuid NOT NULL REFERENCES public.cnab_retornos(id) ON DELETE CASCADE,
  remessa_item_id uuid REFERENCES public.cnab_remessa_itens(id) ON DELETE SET NULL,
  nosso_numero text NOT NULL,
  codigo_ocorrencia text,
  descricao_ocorrencia text,
  valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  data_ocorrencia date,
  conciliado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cnab_retorno_ocorrencias_retorno ON public.cnab_retorno_ocorrencias(retorno_id);
CREATE INDEX idx_cnab_retorno_ocorrencias_item ON public.cnab_retorno_ocorrencias(remessa_item_id);

-- ---------------------------------------------------------------------------
-- RPCs atômicas — mesmo padrão de emitir_oc_atomico/registrar_recebimento_atomico.
-- ---------------------------------------------------------------------------

-- Cria a remessa (cabeçalho + todos os itens) numa única transação, reserva o
-- próximo número de arquivo do convênio e gera o "nosso número" de cada item.
-- Não gera o arquivo-texto em si (isso é feito em TS puro, cnab240.ts) — só
-- persiste os dados que o gerador vai consumir, já resolvidos e com o nosso
-- número definitivo.
CREATE OR REPLACE FUNCTION public.fn_cnab_criar_remessa_atomico(
  p_carrinho_id uuid,
  p_conta_bancaria_id uuid,
  p_itens jsonb -- [{origem_tipo, origem_id, favorecido_nome, favorecido_documento,
                --   favorecido_banco, favorecido_agencia, favorecido_agencia_dv,
                --   favorecido_conta, favorecido_conta_dv, valor}]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_carrinho_status text;
  v_numero_arquivo integer;
  v_remessa_id uuid;
  v_item jsonb;
  v_nosso_numero text;
  v_item_id uuid;
  v_itens_out jsonb := '[]'::jsonb;
BEGIN
  PERFORM public._require_any_setor_or_gm('Financeiro');

  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Remessa sem itens — nada para gerar.' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_carrinho_status
  FROM public.financeiro_previsao_carrinho WHERE id = p_carrinho_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carrinho % não encontrado', p_carrinho_id USING ERRCODE = 'P0002';
  END IF;
  IF v_carrinho_status <> 'fechado' THEN
    RAISE EXCEPTION 'Só é possível gerar remessa a partir de um carrinho fechado (status atual: %)', v_carrinho_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.contas_bancarias_empresa
  SET proximo_numero_arquivo = proximo_numero_arquivo + 1
  WHERE id = p_conta_bancaria_id AND ativo
  RETURNING proximo_numero_arquivo - 1 INTO v_numero_arquivo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta bancária % não encontrada ou inativa', p_conta_bancaria_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.cnab_remessas (conta_bancaria_id, carrinho_id, numero_arquivo, status)
  VALUES (p_conta_bancaria_id, p_carrinho_id, v_numero_arquivo, 'rascunho')
  RETURNING id INTO v_remessa_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_nosso_numero := lpad(nextval('public.cnab_nosso_numero_seq')::text, 11, '0');

    INSERT INTO public.cnab_remessa_itens (
      remessa_id, origem_tipo, origem_id, favorecido_nome, favorecido_documento,
      favorecido_banco, favorecido_agencia, favorecido_agencia_dv,
      favorecido_conta, favorecido_conta_dv, valor, nosso_numero
    ) VALUES (
      v_remessa_id,
      v_item->>'origem_tipo', v_item->>'origem_id',
      v_item->>'favorecido_nome', v_item->>'favorecido_documento',
      v_item->>'favorecido_banco', v_item->>'favorecido_agencia', v_item->>'favorecido_agencia_dv',
      v_item->>'favorecido_conta', v_item->>'favorecido_conta_dv',
      (v_item->>'valor')::numeric, v_nosso_numero
    ) RETURNING id INTO v_item_id;

    v_itens_out := v_itens_out || jsonb_build_object(
      'id', v_item_id,
      'origem_tipo', v_item->>'origem_tipo',
      'origem_id', v_item->>'origem_id',
      'favorecido_nome', v_item->>'favorecido_nome',
      'favorecido_documento', v_item->>'favorecido_documento',
      'favorecido_banco', v_item->>'favorecido_banco',
      'favorecido_agencia', v_item->>'favorecido_agencia',
      'favorecido_agencia_dv', v_item->>'favorecido_agencia_dv',
      'favorecido_conta', v_item->>'favorecido_conta',
      'favorecido_conta_dv', v_item->>'favorecido_conta_dv',
      'valor', (v_item->>'valor')::numeric,
      'nosso_numero', v_nosso_numero
    );
  END LOOP;

  RETURN jsonb_build_object(
    'remessa_id', v_remessa_id,
    'numero_arquivo', v_numero_arquivo,
    'itens', v_itens_out
  );
END $$;
REVOKE ALL ON FUNCTION public.fn_cnab_criar_remessa_atomico(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cnab_criar_remessa_atomico(uuid, uuid, jsonb) TO authenticated, service_role;

-- Marca a remessa como gerada, depois que o arquivo-texto (gerarRemessaCnab240,
-- em TS) foi montado e enviado para o storage.
CREATE OR REPLACE FUNCTION public.fn_cnab_marcar_remessa_gerada(p_remessa_id uuid, p_arquivo_path text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._require_any_setor_or_gm('Financeiro');
  UPDATE public.cnab_remessas SET arquivo_path = p_arquivo_path, status = 'gerada'
  WHERE id = p_remessa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Remessa % não encontrada', p_remessa_id USING ERRCODE = 'P0002';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.fn_cnab_marcar_remessa_gerada(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cnab_marcar_remessa_gerada(uuid, text) TO authenticated, service_role;

-- Concilia uma ocorrência de retorno com o item de remessa correspondente
-- (casado por nosso_numero). Quando a origem é `ref_lancamento` (título
-- TOTVS/Postgres), já dá baixa direto em financeiro_lancamentos. Quando a
-- origem é `solicitacao` (aprovação financeira — hoje majoritariamente
-- MySQL/api.php, id numérico), não dá pra fazer isso com um UPDATE aqui: a
-- função só retorna origem_tipo/origem_id para o chamador (TS) completar a
-- baixa no backend certo (api.php para id numérico, ou a tabela Postgres
-- vestigial para o caso legado de id em formato uuid).
CREATE OR REPLACE FUNCTION public.fn_cnab_conciliar_ocorrencia(
  p_retorno_id uuid,
  p_nosso_numero text,
  p_codigo_ocorrencia text,
  p_descricao_ocorrencia text,
  p_data_ocorrencia date,
  p_valor_pago numeric
)
RETURNS TABLE (ocorrencia_id uuid, matched boolean, origem_tipo text, origem_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.cnab_remessa_itens%ROWTYPE;
  v_ocorrencia_id uuid;
BEGIN
  PERFORM public._require_any_setor_or_gm('Financeiro');

  SELECT * INTO v_item FROM public.cnab_remessa_itens WHERE nosso_numero = p_nosso_numero;

  INSERT INTO public.cnab_retorno_ocorrencias (
    retorno_id, remessa_item_id, nosso_numero, codigo_ocorrencia,
    descricao_ocorrencia, valor_pago, data_ocorrencia, conciliado
  ) VALUES (
    p_retorno_id, v_item.id, p_nosso_numero, p_codigo_ocorrencia,
    p_descricao_ocorrencia, p_valor_pago, p_data_ocorrencia, v_item.id IS NOT NULL
  ) RETURNING id INTO v_ocorrencia_id;

  IF v_item.id IS NOT NULL AND v_item.origem_tipo = 'ref_lancamento' THEN
    UPDATE public.financeiro_lancamentos
    SET status_cod = 3, status_label = 'Baixado',
        valor_baixado = p_valor_pago, data_baixa = p_data_ocorrencia,
        data_pagamento = p_data_ocorrencia, conciliado = true
    WHERE ref_lancamento = v_item.origem_id::bigint;
  END IF;

  RETURN QUERY SELECT v_ocorrencia_id, (v_item.id IS NOT NULL), v_item.origem_tipo, v_item.origem_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_cnab_conciliar_ocorrencia(uuid, text, text, text, date, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_cnab_conciliar_ocorrencia(uuid, text, text, text, date, numeric) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- GRANTs e RLS — CNAB move dinheiro de verdade, então mais restrito que o
-- padrão largo de Suprimentos: só Financeiro/GM (nenhuma leitura por obra).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contas_bancarias_empresa', 'cnab_remessas', 'cnab_remessa_itens',
    'cnab_retornos', 'cnab_retorno_ocorrencias'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

CREATE POLICY "contas_bancarias_empresa rw" ON public.contas_bancarias_empresa FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));

CREATE POLICY "cnab_remessas rw" ON public.cnab_remessas FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));

CREATE POLICY "cnab_remessa_itens rw" ON public.cnab_remessa_itens FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));

CREATE POLICY "cnab_retornos rw" ON public.cnab_retornos FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));

CREATE POLICY "cnab_retorno_ocorrencias rw" ON public.cnab_retorno_ocorrencias FOR ALL TO authenticated
  USING (public.current_is_gm() OR public.current_has_setor('Financeiro'))
  WITH CHECK (public.current_is_gm() OR public.current_has_setor('Financeiro'));
