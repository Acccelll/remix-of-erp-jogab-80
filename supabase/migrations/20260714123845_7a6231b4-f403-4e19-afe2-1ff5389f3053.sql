-- PRO-007.slice-03 — bootstrap idempotente + workflow de Não Conformidades

CREATE TABLE IF NOT EXISTS public.nao_conformidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid REFERENCES public.obras(id) ON DELETE CASCADE,
  inspecao_id uuid,
  resposta_id uuid,
  card_id uuid REFERENCES public.cards(id) ON DELETE SET NULL,
  cronograma_item_id uuid REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  codigo text,
  titulo text NOT NULL,
  descricao text,
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratativa','resolvida','cancelada')),
  o_que text,
  por_que text,
  onde text,
  quando_planejado date,
  quem uuid,
  como text,
  quanto numeric(14,2),
  assinatura text,
  reincidencia_de uuid,
  acao_corretiva text,
  acao_preventiva text,
  evidencia_path text,
  resolvida_em timestamptz,
  resolvida_por uuid,
  responsavel_id uuid,
  prazo timestamptz,
  tratativa text,
  reinspecao_resultado text CHECK (reinspecao_resultado IS NULL OR reinspecao_resultado IN ('aprovada','reprovada')),
  reinspecionada_em timestamptz,
  encerrada_em timestamptz,
  aguardando_reinspecao boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nao_conformidades_aguardando_status_check CHECK (aguardando_reinspecao = false OR status = 'em_tratativa')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nao_conformidades TO authenticated;
GRANT ALL ON public.nao_conformidades TO service_role;

ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS prazo timestamptz,
  ADD COLUMN IF NOT EXISTS tratativa text,
  ADD COLUMN IF NOT EXISTS reinspecao_resultado text,
  ADD COLUMN IF NOT EXISTS reinspecionada_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aguardando_reinspecao boolean NOT NULL DEFAULT false;

-- Compatibilidade para ambientes que já tinham a tabela legada.
UPDATE public.nao_conformidades
SET
  responsavel_id = COALESCE(responsavel_id, quem),
  prazo = COALESCE(prazo, quando_planejado::timestamptz),
  tratativa = COALESCE(tratativa, NULLIF(TRIM(COALESCE(como, acao_corretiva, '')), '')),
  encerrada_em = COALESCE(encerrada_em, resolvida_em),
  aguardando_reinspecao = aguardando_reinspecao
WHERE
  responsavel_id IS NULL
  OR prazo IS NULL
  OR tratativa IS NULL
  OR encerrada_em IS NULL;

ALTER TABLE public.nao_conformidades
  DROP CONSTRAINT IF EXISTS nao_conformidades_status_check,
  ADD CONSTRAINT nao_conformidades_status_check
    CHECK (status IN ('aberta','em_tratativa','resolvida','cancelada'));

ALTER TABLE public.nao_conformidades
  DROP CONSTRAINT IF EXISTS nao_conformidades_reinspecao_resultado_check,
  ADD CONSTRAINT nao_conformidades_reinspecao_resultado_check
    CHECK (reinspecao_resultado IS NULL OR reinspecao_resultado IN ('aprovada','reprovada'));

ALTER TABLE public.nao_conformidades
  DROP CONSTRAINT IF EXISTS nao_conformidades_aguardando_status_check,
  ADD CONSTRAINT nao_conformidades_aguardando_status_check
    CHECK (aguardando_reinspecao = false OR status = 'em_tratativa');

CREATE INDEX IF NOT EXISTS idx_nc_obra ON public.nao_conformidades(obra_id);
CREATE INDEX IF NOT EXISTS idx_nc_status ON public.nao_conformidades(status);
CREATE INDEX IF NOT EXISTS idx_nc_assinatura ON public.nao_conformidades(assinatura) WHERE assinatura IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nc_inspecao ON public.nao_conformidades(inspecao_id) WHERE inspecao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nc_card ON public.nao_conformidades(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nc_responsavel_id ON public.nao_conformidades(responsavel_id) WHERE responsavel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nc_prazo_abertas ON public.nao_conformidades(prazo) WHERE status NOT IN ('resolvida','cancelada') AND prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nc_aguardando_reinspecao ON public.nao_conformidades(aguardando_reinspecao) WHERE aguardando_reinspecao = true;

DROP TRIGGER IF EXISTS trg_nc_updated ON public.nao_conformidades;
CREATE TRIGGER trg_nc_updated BEFORE UPDATE ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.fn_nc_marca_resolvida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    NEW.resolvida_em := COALESCE(NEW.resolvida_em, now());
    NEW.resolvida_por := COALESCE(NEW.resolvida_por, auth.uid());
    NEW.encerrada_em := COALESCE(NEW.encerrada_em, NEW.resolvida_em, now());
  ELSIF NEW.status <> 'resolvida' THEN
    NEW.resolvida_em := NULL;
    NEW.resolvida_por := NULL;
    IF NEW.status <> 'cancelada' THEN
      NEW.encerrada_em := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nc_resolvida ON public.nao_conformidades;
CREATE TRIGGER trg_nc_resolvida BEFORE UPDATE ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_nc_marca_resolvida();

CREATE OR REPLACE FUNCTION public.fn_nc_gera_codigo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ano text;
  v_seq int;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN
    RETURN NEW;
  END IF;

  v_ano := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '^NC-\d{4}-', ''), '')::int), 0) + 1
    INTO v_seq
    FROM public.nao_conformidades
   WHERE codigo LIKE 'NC-' || v_ano || '-%'
     AND (obra_id IS NOT DISTINCT FROM NEW.obra_id);

  NEW.codigo := 'NC-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_nc_codigo ON public.nao_conformidades;
CREATE TRIGGER trg_nc_codigo BEFORE INSERT ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_nc_gera_codigo();

DROP POLICY IF EXISTS "nc read por obra e qualidade" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc insert por obra" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc update por obra" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc delete gm" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc deletar gm" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc editar gm/qualidade/eng/seg/quem" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc inserir autenticado" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc visiveis para setores e responsavel" ON public.nao_conformidades;

CREATE POLICY "nc read por obra e qualidade"
ON public.nao_conformidades
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR created_by = auth.uid()
  OR quem = auth.uid()
  OR responsavel_id = auth.uid()
  OR (obra_id IS NOT NULL AND public.user_em_obra(obra_id))
);

CREATE POLICY "nc insert por obra"
ON public.nao_conformidades
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (obra_id IS NULL OR public.user_pode_editar_obra(obra_id))
);

CREATE POLICY "nc update por obra"
ON public.nao_conformidades
FOR UPDATE
TO authenticated
USING (
  public.current_is_gm()
  OR created_by = auth.uid()
  OR quem = auth.uid()
  OR responsavel_id = auth.uid()
  OR (obra_id IS NOT NULL AND public.user_pode_editar_obra(obra_id))
)
WITH CHECK (
  public.current_is_gm()
  OR created_by = auth.uid()
  OR quem = auth.uid()
  OR responsavel_id = auth.uid()
  OR (obra_id IS NOT NULL AND public.user_pode_editar_obra(obra_id))
);

CREATE POLICY "nc delete gm"
ON public.nao_conformidades
FOR DELETE
TO authenticated
USING (public.current_is_gm());