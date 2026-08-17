
CREATE TABLE IF NOT EXISTS public.faturamento_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nfse text NOT NULL,
  codigo_verificacao text,
  data_emissao date,
  competencia date,
  prestador_cnpj text,
  prestador_razao text,
  tomador_cnpj text,
  tomador_razao text,
  tomador_uf text,
  tomador_municipio text,
  municipio_prestacao text,
  item_lista_servico text,
  codigo_servico text,
  codigo_obra_interno text,
  codigo_obra text,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  numero_bms text,
  pedido text,
  discriminacao text,
  valor_servicos numeric(14,2) DEFAULT 0,
  deducoes numeric(14,2) DEFAULT 0,
  base_calculo numeric(14,2) DEFAULT 0,
  aliquota_iss numeric(8,4) DEFAULT 0,
  valor_iss numeric(14,2) DEFAULT 0,
  iss_retido boolean DEFAULT false,
  valor_inss numeric(14,2) DEFAULT 0,
  valor_ir numeric(14,2) DEFAULT 0,
  valor_csll numeric(14,2) DEFAULT 0,
  valor_pis numeric(14,2) DEFAULT 0,
  valor_cofins numeric(14,2) DEFAULT 0,
  outras_retencoes numeric(14,2) DEFAULT 0,
  valor_liquido numeric(14,2) DEFAULT 0,
  percentual_material numeric(8,4),
  natureza_operacao text,
  status text DEFAULT 'emitida',
  origem text NOT NULL DEFAULT 'planilha',
  arquivo_origem text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fat_nfse_numero_codver
  ON public.faturamento_nfse (numero_nfse, COALESCE(codigo_verificacao, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturamento_nfse TO authenticated;
GRANT ALL ON public.faturamento_nfse TO service_role;

ALTER TABLE public.faturamento_nfse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fat_nfse_auth_all" ON public.faturamento_nfse;
CREATE POLICY "fat_nfse_auth_all"
  ON public.faturamento_nfse FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fat_nfse_obra ON public.faturamento_nfse(obra_id);
CREATE INDEX IF NOT EXISTS idx_fat_nfse_emissao ON public.faturamento_nfse(data_emissao);
CREATE INDEX IF NOT EXISTS idx_fat_nfse_tomador ON public.faturamento_nfse(tomador_cnpj);

DROP TRIGGER IF EXISTS trg_fat_nfse_touch ON public.faturamento_nfse;
CREATE TRIGGER trg_fat_nfse_touch
  BEFORE UPDATE ON public.faturamento_nfse
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.bms_previstas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'regua',
  ADD COLUMN IF NOT EXISTS editado_em timestamptz,
  ADD COLUMN IF NOT EXISTS valor_realizado numeric(14,2);

CREATE OR REPLACE FUNCTION public.fn_sync_medicao_para_bms_prevista()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_num int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.bms_previstas
       SET medicao_id = NULL,
           valor_realizado = NULL,
           status = 'prevista',
           editado_em = now()
     WHERE medicao_id = OLD.id;
    RETURN OLD;
  END IF;
  BEGIN
    v_num := NULLIF(regexp_replace(COALESCE(NEW.numero,''), '\D', '', 'g'), '')::int;
  EXCEPTION WHEN OTHERS THEN v_num := NULL;
  END;
  IF v_num IS NOT NULL THEN
    UPDATE public.bms_previstas
       SET medicao_id = NEW.id,
           valor_realizado = NEW.valor,
           status = 'realizada',
           editado_em = now()
     WHERE obra_id = NEW.obra_id
       AND numero = v_num
       AND (medicao_id IS NULL OR medicao_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_medicoes_sync_previstas ON public.medicoes;
CREATE TRIGGER trg_medicoes_sync_previstas
  AFTER INSERT OR UPDATE OR DELETE ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_medicao_para_bms_prevista();

CREATE OR REPLACE FUNCTION public.fn_recalcular_previsao_nf(p_obra_id uuid, p_valor_contrato numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faturado NUMERIC := 0;
  v_fixo NUMERIC := 0;
  v_saldo NUMERIC := 0;
  v_soma_prev NUMERIC := 0;
  v_count INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(valor),0) INTO v_faturado
    FROM public.notas_fiscais
   WHERE obra_id = p_obra_id AND COALESCE(status::text,'') <> 'cancelada';
  SELECT COALESCE(SUM(valor_previsto_dinamico),0) INTO v_fixo
    FROM public.bms_previstas
   WHERE obra_id = p_obra_id
     AND COALESCE(status,'') = 'prevista'
     AND (origem = 'manual' OR medicao_id IS NOT NULL);
  v_saldo := COALESCE(p_valor_contrato,0) - v_faturado - v_fixo;
  SELECT COALESCE(SUM(valor_previsto_dinamico),0), COUNT(*) INTO v_soma_prev, v_count
    FROM public.bms_previstas
   WHERE obra_id = p_obra_id
     AND COALESCE(status,'') = 'prevista'
     AND origem <> 'manual'
     AND medicao_id IS NULL;
  IF v_count = 0 THEN RETURN; END IF;
  IF v_soma_prev > 0 THEN
    UPDATE public.bms_previstas
       SET valor_previsto_dinamico = ROUND(valor_previsto_dinamico * v_saldo / v_soma_prev, 2)
     WHERE obra_id = p_obra_id
       AND COALESCE(status,'') = 'prevista'
       AND origem <> 'manual'
       AND medicao_id IS NULL;
  ELSE
    UPDATE public.bms_previstas
       SET valor_previsto_dinamico = ROUND(v_saldo / v_count, 2)
     WHERE obra_id = p_obra_id
       AND COALESCE(status,'') = 'prevista'
       AND origem <> 'manual'
       AND medicao_id IS NULL;
  END IF;
END $$;
