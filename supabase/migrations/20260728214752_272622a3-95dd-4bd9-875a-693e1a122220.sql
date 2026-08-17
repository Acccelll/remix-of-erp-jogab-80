-- P0.1 · Fundação — Antecipação de Recebíveis
-- (retry: usa has_role() porque current_has_setor() não existe no banco atual)

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS grupo_economico text;

CREATE INDEX IF NOT EXISTS ix_clientes__grupo_economico
  ON public.clientes (grupo_economico);

CREATE TABLE IF NOT EXISTS public.faturamento_nfse (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nfse           text NOT NULL,
  codigo_verificacao    text,
  data_emissao          date,
  competencia           date,
  prestador_cnpj        text,
  prestador_razao       text,
  tomador_cnpj          text,
  tomador_razao         text,
  tomador_uf            text,
  tomador_municipio     text,
  municipio_prestacao   text,
  item_lista_servico    text,
  codigo_servico        text,
  codigo_obra_interno   text,
  codigo_obra           text,
  numero_bms            text,
  pedido                text,
  discriminacao         text,
  valor_servicos        numeric(14,2) NOT NULL DEFAULT 0,
  deducoes              numeric(14,2) NOT NULL DEFAULT 0,
  base_calculo          numeric(14,2) NOT NULL DEFAULT 0,
  aliquota_iss          numeric(8,4)  NOT NULL DEFAULT 0,
  valor_iss             numeric(14,2) NOT NULL DEFAULT 0,
  iss_retido            boolean       NOT NULL DEFAULT false,
  valor_inss            numeric(14,2) NOT NULL DEFAULT 0,
  valor_ir              numeric(14,2) NOT NULL DEFAULT 0,
  valor_csll            numeric(14,2) NOT NULL DEFAULT 0,
  valor_pis             numeric(14,2) NOT NULL DEFAULT 0,
  valor_cofins          numeric(14,2) NOT NULL DEFAULT 0,
  outras_retencoes      numeric(14,2) NOT NULL DEFAULT 0,
  valor_liquido         numeric(14,2) NOT NULL DEFAULT 0,
  natureza_operacao     text,
  arquivo_origem        text,
  obra_id               uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  origem                text NOT NULL DEFAULT 'planilha'
                        CHECK (origem IN ('planilha','xml','manual')),
  status                text,
  data_vencimento       date,
  vencimento_origem     text NOT NULL DEFAULT 'calculado'
                        CHECK (vencimento_origem IN ('calculado','manual','importado')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_faturamento_nfse__numero_codver
    UNIQUE (numero_nfse, codigo_verificacao)
);

CREATE INDEX IF NOT EXISTS ix_faturamento_nfse__data_vencimento
  ON public.faturamento_nfse (data_vencimento);
CREATE INDEX IF NOT EXISTS ix_faturamento_nfse__obra
  ON public.faturamento_nfse (obra_id);
CREATE INDEX IF NOT EXISTS ix_faturamento_nfse__emissao
  ON public.faturamento_nfse (data_emissao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturamento_nfse TO authenticated;
GRANT ALL ON public.faturamento_nfse TO service_role;

ALTER TABLE public.faturamento_nfse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fat_nfse_read"  ON public.faturamento_nfse;
DROP POLICY IF EXISTS "fat_nfse_write" ON public.faturamento_nfse;

CREATE POLICY "fat_nfse_read"
  ON public.faturamento_nfse
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "fat_nfse_write"
  ON public.faturamento_nfse
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR public.has_role(auth.uid(), 'gm'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR public.has_role(auth.uid(), 'gm'::public.app_role)
  );

DROP TRIGGER IF EXISTS trg_touch_updated_at__faturamento_nfse
  ON public.faturamento_nfse;
CREATE TRIGGER trg_touch_updated_at__faturamento_nfse
  BEFORE UPDATE ON public.faturamento_nfse
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
