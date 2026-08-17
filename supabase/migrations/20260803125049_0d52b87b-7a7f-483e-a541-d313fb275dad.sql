ALTER TABLE public.faturamento_nfse
  DROP CONSTRAINT IF EXISTS uq_faturamento_nfse__numero_codver;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fat_nfse_numero_codver
  ON public.faturamento_nfse (numero_nfse, COALESCE(codigo_verificacao, ''));

CREATE OR REPLACE FUNCTION public.fn_importar_faturamento_lote(p_faturas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_novas integer := 0;
  v_atualizadas integer := 0;
  v_inalteradas integer := 0;
  v_vinculadas integer := 0;
BEGIN
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR NOT (
       public.has_role(auth.uid(), 'financeiro')
       OR public.has_role(auth.uid(), 'gm')
       OR public.current_player_has_access('financeiro')
     )) THEN
    RAISE EXCEPTION 'Usuário sem permissão para importar faturamento.' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(COALESCE(p_faturas, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'O lote de faturamento deve ser uma lista.' USING ERRCODE = '22023';
  END IF;

  CREATE TEMP TABLE _fat_src ON COMMIT DROP AS
  SELECT DISTINCT ON (numero_nfse, COALESCE(codigo_verificacao, '')) *
  FROM jsonb_to_recordset(COALESCE(p_faturas, '[]'::jsonb)) AS x(
    numero_nfse text, codigo_verificacao text, data_emissao date, competencia date,
    prestador_cnpj text, prestador_razao text, tomador_cnpj text, tomador_razao text,
    tomador_uf text, tomador_municipio text, municipio_prestacao text,
    item_lista_servico text, codigo_servico text, codigo_obra_interno text,
    codigo_obra text, obra_id uuid, numero_bms text, pedido text, discriminacao text,
    valor_servicos numeric, deducoes numeric, base_calculo numeric, aliquota_iss numeric,
    valor_iss numeric, iss_retido boolean, valor_inss numeric, valor_ir numeric,
    valor_csll numeric, valor_pis numeric, valor_cofins numeric, outras_retencoes numeric,
    valor_liquido numeric, natureza_operacao text, arquivo_origem text, origem text
  )
  WHERE NULLIF(trim(numero_nfse), '') IS NOT NULL
  ORDER BY numero_nfse, COALESCE(codigo_verificacao, '');

  SELECT COUNT(*), COUNT(*) FILTER (WHERE obra_id IS NOT NULL)
    INTO v_total, v_vinculadas
  FROM _fat_src;

  SELECT COUNT(*) INTO v_inalteradas
  FROM _fat_src s
  JOIN public.faturamento_nfse f
    ON f.numero_nfse = s.numero_nfse
   AND COALESCE(f.codigo_verificacao, '') = COALESCE(s.codigo_verificacao, '')
  WHERE f.origem = 'xml' AND COALESCE(s.origem, 'planilha') = 'planilha';

  WITH gravadas AS (
    INSERT INTO public.faturamento_nfse AS f (
      numero_nfse, codigo_verificacao, data_emissao, competencia,
      prestador_cnpj, prestador_razao, tomador_cnpj, tomador_razao,
      tomador_uf, tomador_municipio, municipio_prestacao, item_lista_servico,
      codigo_servico, codigo_obra_interno, codigo_obra, obra_id, numero_bms,
      pedido, discriminacao, valor_servicos, deducoes, base_calculo,
      aliquota_iss, valor_iss, iss_retido, valor_inss, valor_ir, valor_csll,
      valor_pis, valor_cofins, outras_retencoes, valor_liquido,
      natureza_operacao, arquivo_origem, origem
    )
    SELECT
      numero_nfse, codigo_verificacao, data_emissao, competencia,
      prestador_cnpj, prestador_razao, tomador_cnpj, tomador_razao,
      tomador_uf, tomador_municipio, municipio_prestacao, item_lista_servico,
      codigo_servico, codigo_obra_interno, codigo_obra, obra_id, numero_bms,
      pedido, discriminacao, COALESCE(valor_servicos, 0), COALESCE(deducoes, 0),
      COALESCE(base_calculo, 0), COALESCE(aliquota_iss, 0), COALESCE(valor_iss, 0),
      COALESCE(iss_retido, false), COALESCE(valor_inss, 0), COALESCE(valor_ir, 0),
      COALESCE(valor_csll, 0), COALESCE(valor_pis, 0), COALESCE(valor_cofins, 0),
      COALESCE(outras_retencoes, 0), COALESCE(valor_liquido, 0),
      natureza_operacao, arquivo_origem, COALESCE(origem, 'planilha')
    FROM _fat_src
    ON CONFLICT (numero_nfse, COALESCE(codigo_verificacao, '')) DO UPDATE SET
      data_emissao = EXCLUDED.data_emissao,
      competencia = EXCLUDED.competencia,
      prestador_cnpj = EXCLUDED.prestador_cnpj,
      prestador_razao = EXCLUDED.prestador_razao,
      tomador_cnpj = EXCLUDED.tomador_cnpj,
      tomador_razao = EXCLUDED.tomador_razao,
      tomador_uf = EXCLUDED.tomador_uf,
      tomador_municipio = EXCLUDED.tomador_municipio,
      municipio_prestacao = EXCLUDED.municipio_prestacao,
      item_lista_servico = EXCLUDED.item_lista_servico,
      codigo_servico = EXCLUDED.codigo_servico,
      codigo_obra_interno = EXCLUDED.codigo_obra_interno,
      codigo_obra = EXCLUDED.codigo_obra,
      obra_id = EXCLUDED.obra_id,
      numero_bms = EXCLUDED.numero_bms,
      pedido = EXCLUDED.pedido,
      discriminacao = EXCLUDED.discriminacao,
      valor_servicos = EXCLUDED.valor_servicos,
      deducoes = EXCLUDED.deducoes,
      base_calculo = EXCLUDED.base_calculo,
      aliquota_iss = EXCLUDED.aliquota_iss,
      valor_iss = EXCLUDED.valor_iss,
      iss_retido = EXCLUDED.iss_retido,
      valor_inss = EXCLUDED.valor_inss,
      valor_ir = EXCLUDED.valor_ir,
      valor_csll = EXCLUDED.valor_csll,
      valor_pis = EXCLUDED.valor_pis,
      valor_cofins = EXCLUDED.valor_cofins,
      outras_retencoes = EXCLUDED.outras_retencoes,
      valor_liquido = EXCLUDED.valor_liquido,
      natureza_operacao = EXCLUDED.natureza_operacao,
      arquivo_origem = EXCLUDED.arquivo_origem,
      origem = EXCLUDED.origem
    WHERE NOT (f.origem = 'xml' AND EXCLUDED.origem = 'planilha')
    RETURNING xmax = 0 AS inserida
  )
  SELECT COUNT(*) FILTER (WHERE inserida), COUNT(*) FILTER (WHERE NOT inserida)
    INTO v_novas, v_atualizadas
  FROM gravadas;

  RETURN jsonb_build_object(
    'novas', v_novas,
    'atualizadas', v_atualizadas,
    'inalteradas', v_inalteradas,
    'vinculadas_obra', v_vinculadas,
    'total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_importar_faturamento_lote(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_faturamento_lote(jsonb) TO authenticated, service_role;