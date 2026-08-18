CREATE TABLE IF NOT EXISTS public.financeiro_tipos_documento (
  codigo text PRIMARY KEY,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  origem text NOT NULL DEFAULT 'totvs',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_tipos_documento_codigo_ck CHECK (codigo ~ '^[0-9]{2}$'),
  CONSTRAINT financeiro_tipos_documento_descricao_ck CHECK (length(btrim(descricao)) > 0),
  CONSTRAINT financeiro_tipos_documento_origem_ck CHECK (length(btrim(origem)) > 0)
);

COMMENT ON TABLE public.financeiro_tipos_documento IS
  'Catalogo operacional de tipos de documento financeiro, espelhando os codigos/descricoes ativos do TOTVS usados no cadastro de titulos ERP.';
COMMENT ON COLUMN public.financeiro_tipos_documento.codigo IS
  'Codigo do Tipo de Documento no TOTVS, preservado sem renumeracao.';

ALTER TABLE public.financeiro_tipos_documento ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.financeiro_tipos_documento FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.financeiro_tipos_documento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financeiro_tipos_documento TO service_role;

DROP POLICY IF EXISTS financeiro_tipos_documento_select ON public.financeiro_tipos_documento;
CREATE POLICY financeiro_tipos_documento_select
ON public.financeiro_tipos_documento
FOR SELECT
TO authenticated
USING (
  has_role((SELECT auth.uid()), 'financeiro'::app_role)
  OR has_role((SELECT auth.uid()), 'gm'::app_role)
  OR private.current_player_has_access('financeiro'::text)
);

INSERT INTO public.financeiro_tipos_documento (codigo, descricao, ativo, origem)
VALUES
  ('01', 'Boleto', true, 'totvs'),
  ('03', 'NFS-e', true, 'totvs'),
  ('04', 'NF-e (Modelo 55)', true, 'totvs'),
  ('05', 'NF Energia Elétrica', true, 'totvs'),
  ('06', 'NF Telecomunicação', true, 'totvs'),
  ('07', 'CT-e', true, 'totvs'),
  ('08', 'RPA', true, 'totvs'),
  ('09', 'Fatura Agua', true, 'totvs'),
  ('10', 'Fatura', true, 'totvs'),
  ('11', 'Guias Municipais', true, 'totvs'),
  ('12', 'GPS', true, 'totvs'),
  ('13', 'MDF-e', true, 'totvs'),
  ('14', 'DARF', true, 'totvs'),
  ('15', 'DAE', true, 'totvs'),
  ('16', 'FGTS', true, 'totvs'),
  ('17', 'Recibos', true, 'totvs'),
  ('18', 'Recibo Aluguel PF', true, 'totvs'),
  ('19', 'Folha de Pagamento', true, 'totvs'),
  ('20', 'Devolução de Compras', true, 'totvs'),
  ('21', 'Adiantamento de Viagem', true, 'totvs'),
  ('22', 'Adiantamento a Fornecedor', true, 'totvs'),
  ('23', 'Previsão Financeira', true, 'totvs'),
  ('24', 'Outros Recebimentos', true, 'totvs'),
  ('25', 'Adiantamento Cliente', true, 'totvs'),
  ('26', 'NF Comunicação', true, 'totvs'),
  ('28', 'DCTFWeb', true, 'totvs'),
  ('29', 'Locação', true, 'totvs'),
  ('30', 'NF Combustível', true, 'totvs'),
  ('31', 'Alimentação', true, 'totvs'),
  ('32', 'Financiamento', true, 'totvs'),
  ('33', 'Cupom Fiscal', true, 'totvs'),
  ('34', 'NFC-e / CF-e', true, 'totvs'),
  ('35', 'Nota de Débito', true, 'totvs'),
  ('36', 'Fatura Cartão de Crédito', true, 'totvs'),
  ('37', 'Fatura e Despesas Bancarias', true, 'totvs'),
  ('39', 'Contrato', true, 'totvs'),
  ('40', 'DANFPSE (Doc Aux NF Prest Serv Eletron)', true, 'totvs'),
  ('41', 'Previsão Recorrente', true, 'totvs')
ON CONFLICT (codigo) DO UPDATE
SET descricao = EXCLUDED.descricao,
    ativo = EXCLUDED.ativo,
    origem = EXCLUDED.origem,
    atualizado_em = now();

CREATE OR REPLACE FUNCTION private.fn_financeiro_validar_tipo_documento_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.origem_tipo = 'manual' THEN
    IF NULLIF(btrim(NEW.tipo_documento), '') IS NULL THEN
      RAISE EXCEPTION 'Tipo de Documento e obrigatorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.financeiro_tipos_documento td
      WHERE td.codigo = btrim(NEW.tipo_documento)
        AND td.ativo IS TRUE
    ) THEN
      RAISE EXCEPTION 'Tipo de Documento invalido ou inativo: %', NEW.tipo_documento;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.fn_financeiro_validar_tipo_documento_manual() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.fn_financeiro_validar_tipo_documento_manual() TO service_role;

DROP TRIGGER IF EXISTS trg_fin_titulos_tipo_documento_manual ON public.financeiro_titulos;
CREATE TRIGGER trg_fin_titulos_tipo_documento_manual
BEFORE INSERT OR UPDATE OF origem_tipo, tipo_documento
ON public.financeiro_titulos
FOR EACH ROW
EXECUTE FUNCTION private.fn_financeiro_validar_tipo_documento_manual();