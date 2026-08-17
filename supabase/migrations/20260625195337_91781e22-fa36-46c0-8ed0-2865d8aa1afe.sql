
-- ============================================================
-- INSP.1 — Modelos de inspeção, inspeções, respostas, NCs
-- ============================================================

-- ----------- inspecao_modelos -----------
CREATE TABLE public.inspecao_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  -- categoria: FVS (Verificação de Serviço), FVM (Verificação de Materiais),
  -- recebimento, seguranca, qualidade, outros
  categoria TEXT NOT NULL CHECK (categoria IN ('fvs','fvm','recebimento','seguranca','qualidade','outros')),
  setor TEXT, -- setor responsável (Qualidade, Segurança, Engenharia, Suprimentos)
  versao INT NOT NULL DEFAULT 1,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE, -- NULL = global
  ativo BOOLEAN NOT NULL DEFAULT true,
  publicado BOOLEAN NOT NULL DEFAULT false,
  -- Score mínimo para considerar "aprovado" (0-100). NULL = sem score automático.
  score_minimo NUMERIC(5,2),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_modelos TO authenticated;
GRANT ALL ON public.inspecao_modelos TO service_role;
ALTER TABLE public.inspecao_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos visiveis para autenticados"
  ON public.inspecao_modelos FOR SELECT TO authenticated
  USING (publicado = true OR public.current_is_gm()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()));

CREATE POLICY "modelos editaveis por gm/qualidade/eng/seg"
  ON public.inspecao_modelos FOR ALL TO authenticated
  USING (public.current_is_gm()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()))
  WITH CHECK (public.current_is_gm()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()));

CREATE INDEX idx_inspecao_modelos_obra ON public.inspecao_modelos(obra_id) WHERE obra_id IS NOT NULL;
CREATE INDEX idx_inspecao_modelos_cat ON public.inspecao_modelos(categoria, ativo);

-- ----------- inspecao_perguntas -----------
CREATE TABLE public.inspecao_perguntas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id UUID NOT NULL REFERENCES public.inspecao_modelos(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  -- agrupamento opcional (ex.: "Estrutura", "Acabamento")
  grupo TEXT,
  texto TEXT NOT NULL,
  -- tipo da resposta:
  --   sim_nao_na = conforme/não-conforme/não se aplica
  --   numero, texto, foto, escolha (lista), escala (1-5)
  tipo TEXT NOT NULL CHECK (tipo IN ('sim_nao_na','numero','texto','foto','escolha','escala')),
  obrigatoria BOOLEAN NOT NULL DEFAULT true,
  peso NUMERIC(6,2) NOT NULL DEFAULT 1,
  -- Configuração: opções (para escolha), unidade (numero), min/max, etc.
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Regra condicional: exibe esta pergunta somente se a pergunta `depende_de`
  -- for respondida com `depende_valor`. NULL = sempre exibe.
  depende_de UUID REFERENCES public.inspecao_perguntas(id) ON DELETE SET NULL,
  depende_valor TEXT,
  -- Se = 'nao' (em sim_nao_na) ou outra condição, gera NC automaticamente.
  gera_nc_se TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modelo_id, ordem)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_perguntas TO authenticated;
GRANT ALL ON public.inspecao_perguntas TO service_role;
ALTER TABLE public.inspecao_perguntas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perguntas seguem permissao do modelo"
  ON public.inspecao_perguntas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inspecao_modelos m WHERE m.id = modelo_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inspecao_modelos m WHERE m.id = modelo_id));

CREATE INDEX idx_inspecao_perguntas_modelo ON public.inspecao_perguntas(modelo_id, ordem);

-- ----------- inspecoes (cabeçalho) -----------
CREATE TABLE public.inspecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id UUID NOT NULL REFERENCES public.inspecao_modelos(id) ON DELETE RESTRICT,
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  -- Vínculo opcional com cronograma/card (FVS de uma atividade, FVM de um recurso)
  cronograma_item_id UUID REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  -- Local livre (pavimento, eixo, sala) e geolocalização opcional
  local TEXT,
  geo_lat NUMERIC(10,7),
  geo_lng NUMERIC(10,7),
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Data planejada vs executada (paridade Checklist Fácil agendamento)
  data_planejada DATE,
  data_inspecao TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_execucao','concluida','reprovada','cancelada')),
  score NUMERIC(6,2),
  aprovado BOOLEAN,
  observacao TEXT,
  -- Assinatura (paridade 2º nível: assinatura digital) - URL ou base64 path
  assinatura_path TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecoes TO authenticated;
GRANT ALL ON public.inspecoes TO service_role;
ALTER TABLE public.inspecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspecoes visiveis para setores e autor"
  ON public.inspecoes FOR SELECT TO authenticated
  USING (public.current_is_gm()
         OR created_by = auth.uid()
         OR responsavel_id = auth.uid()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()));

CREATE POLICY "inspecoes inserir autenticado"
  ON public.inspecoes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "inspecoes editar autor/responsavel/gm"
  ON public.inspecoes FOR UPDATE TO authenticated
  USING (public.current_is_gm() OR created_by = auth.uid() OR responsavel_id = auth.uid())
  WITH CHECK (public.current_is_gm() OR created_by = auth.uid() OR responsavel_id = auth.uid());

CREATE POLICY "inspecoes deletar gm"
  ON public.inspecoes FOR DELETE TO authenticated
  USING (public.current_is_gm());

CREATE INDEX idx_inspecoes_obra ON public.inspecoes(obra_id);
CREATE INDEX idx_inspecoes_modelo ON public.inspecoes(modelo_id);
CREATE INDEX idx_inspecoes_card ON public.inspecoes(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_inspecoes_cron ON public.inspecoes(cronograma_item_id) WHERE cronograma_item_id IS NOT NULL;
CREATE INDEX idx_inspecoes_status ON public.inspecoes(status, data_inspecao DESC);

-- ----------- inspecao_respostas -----------
CREATE TABLE public.inspecao_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspecao_id UUID NOT NULL REFERENCES public.inspecoes(id) ON DELETE CASCADE,
  pergunta_id UUID NOT NULL REFERENCES public.inspecao_perguntas(id) ON DELETE RESTRICT,
  -- Resposta polimórfica: usa o campo do tipo da pergunta.
  resposta_texto TEXT,
  resposta_numero NUMERIC(14,4),
  resposta_opcao TEXT,
  -- Para sim_nao_na: 'sim' | 'nao' | 'na'
  conformidade TEXT CHECK (conformidade IN ('sim','nao','na')),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inspecao_id, pergunta_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_respostas TO authenticated;
GRANT ALL ON public.inspecao_respostas TO service_role;
ALTER TABLE public.inspecao_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "respostas seguem permissao da inspecao"
  ON public.inspecao_respostas FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inspecoes i WHERE i.id = inspecao_id
      AND (public.current_is_gm() OR i.created_by = auth.uid() OR i.responsavel_id = auth.uid()
           OR 'Qualidade' = ANY(public.current_setores())
           OR 'Engenharia' = ANY(public.current_setores())
           OR 'Segurança' = ANY(public.current_setores()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.inspecoes i WHERE i.id = inspecao_id
      AND (public.current_is_gm() OR i.created_by = auth.uid() OR i.responsavel_id = auth.uid())
  ));

CREATE INDEX idx_inspecao_respostas_inspecao ON public.inspecao_respostas(inspecao_id);

-- ----------- inspecao_fotos -----------
CREATE TABLE public.inspecao_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id UUID NOT NULL REFERENCES public.inspecao_respostas(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  legenda TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_fotos TO authenticated;
GRANT ALL ON public.inspecao_fotos TO service_role;
ALTER TABLE public.inspecao_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fotos seguem permissao da resposta"
  ON public.inspecao_fotos FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.inspecao_respostas r
    JOIN public.inspecoes i ON i.id = r.inspecao_id
    WHERE r.id = resposta_id
      AND (public.current_is_gm() OR i.created_by = auth.uid() OR i.responsavel_id = auth.uid()
           OR 'Qualidade' = ANY(public.current_setores())
           OR 'Engenharia' = ANY(public.current_setores())
           OR 'Segurança' = ANY(public.current_setores()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.inspecao_respostas r
    JOIN public.inspecoes i ON i.id = r.inspecao_id
    WHERE r.id = resposta_id
      AND (public.current_is_gm() OR i.created_by = auth.uid() OR i.responsavel_id = auth.uid())
  ));

CREATE INDEX idx_inspecao_fotos_resposta ON public.inspecao_fotos(resposta_id);

-- ----------- nao_conformidades (5W2H + reincidência) -----------
CREATE TABLE public.nao_conformidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES public.obras(id) ON DELETE CASCADE,
  -- Origem opcional
  inspecao_id UUID REFERENCES public.inspecoes(id) ON DELETE SET NULL,
  resposta_id UUID REFERENCES public.inspecao_respostas(id) ON DELETE SET NULL,
  card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
  cronograma_item_id UUID REFERENCES public.cronograma_itens(id) ON DELETE SET NULL,
  codigo TEXT, -- numeração visível (NC-2026-001)
  titulo TEXT NOT NULL,
  descricao TEXT,
  severidade TEXT NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratativa','aguardando_verificacao','resolvida','cancelada')),
  -- 5W2H
  o_que TEXT,         -- What
  por_que TEXT,       -- Why (causa raiz)
  onde TEXT,          -- Where
  quando_planejado DATE, -- When (prazo)
  quem UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who (responsável)
  como TEXT,          -- How (ação corretiva)
  quanto NUMERIC(14,2), -- How much (custo estimado)
  -- Reincidência: hash determinístico (modelo+pergunta+local) para agrupar.
  assinatura TEXT,
  reincidencia_de UUID REFERENCES public.nao_conformidades(id) ON DELETE SET NULL,
  acao_corretiva TEXT,
  acao_preventiva TEXT,
  evidencia_path TEXT,
  resolvida_em TIMESTAMPTZ,
  resolvida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nao_conformidades TO authenticated;
GRANT ALL ON public.nao_conformidades TO service_role;
ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nc visiveis para setores e responsavel"
  ON public.nao_conformidades FOR SELECT TO authenticated
  USING (public.current_is_gm()
         OR created_by = auth.uid()
         OR quem = auth.uid()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()));

CREATE POLICY "nc inserir autenticado"
  ON public.nao_conformidades FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "nc editar gm/qualidade/eng/seg/quem"
  ON public.nao_conformidades FOR UPDATE TO authenticated
  USING (public.current_is_gm() OR quem = auth.uid() OR created_by = auth.uid()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()))
  WITH CHECK (public.current_is_gm() OR quem = auth.uid() OR created_by = auth.uid()
         OR 'Qualidade' = ANY(public.current_setores())
         OR 'Engenharia' = ANY(public.current_setores())
         OR 'Segurança' = ANY(public.current_setores()));

CREATE POLICY "nc deletar gm"
  ON public.nao_conformidades FOR DELETE TO authenticated
  USING (public.current_is_gm());

CREATE INDEX idx_nc_obra ON public.nao_conformidades(obra_id);
CREATE INDEX idx_nc_status ON public.nao_conformidades(status);
CREATE INDEX idx_nc_assinatura ON public.nao_conformidades(assinatura) WHERE assinatura IS NOT NULL;
CREATE INDEX idx_nc_inspecao ON public.nao_conformidades(inspecao_id) WHERE inspecao_id IS NOT NULL;
CREATE INDEX idx_nc_card ON public.nao_conformidades(card_id) WHERE card_id IS NOT NULL;

-- ----------- Triggers de updated_at + resolvida_em -----------
CREATE TRIGGER trg_inspecao_modelos_updated BEFORE UPDATE ON public.inspecao_modelos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_inspecoes_updated BEFORE UPDATE ON public.inspecoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_inspecao_respostas_updated BEFORE UPDATE ON public.inspecao_respostas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_nc_updated BEFORE UPDATE ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Carimba resolvida_em quando NC vira "resolvida"
CREATE OR REPLACE FUNCTION public.fn_nc_marca_resolvida()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolvida' AND (OLD.status IS DISTINCT FROM 'resolvida') THEN
    NEW.resolvida_em := COALESCE(NEW.resolvida_em, now());
    NEW.resolvida_por := COALESCE(NEW.resolvida_por, auth.uid());
  ELSIF NEW.status <> 'resolvida' THEN
    NEW.resolvida_em := NULL;
    NEW.resolvida_por := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_nc_resolvida BEFORE UPDATE ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_nc_marca_resolvida();

-- Numeração automática (NC-YYYY-NNNN por obra)
CREATE OR REPLACE FUNCTION public.fn_nc_gera_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_ano TEXT; v_seq INT;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN RETURN NEW; END IF;
  v_ano := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '^NC-\d{4}-', ''), '')::INT), 0) + 1
    INTO v_seq
    FROM public.nao_conformidades
   WHERE codigo LIKE 'NC-' || v_ano || '-%'
     AND (obra_id IS NOT DISTINCT FROM NEW.obra_id);
  NEW.codigo := 'NC-' || v_ano || '-' || lpad(v_seq::TEXT, 4, '0');
  RETURN NEW;
END $$;

CREATE TRIGGER trg_nc_codigo BEFORE INSERT ON public.nao_conformidades
  FOR EACH ROW EXECUTE FUNCTION public.fn_nc_gera_codigo();

-- ----------- Storage policies para bucket inspecoes-fotos -----------
CREATE POLICY "inspecoes_fotos_select_autenticado"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'inspecoes-fotos');

CREATE POLICY "inspecoes_fotos_insert_autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspecoes-fotos' AND auth.uid() = owner);

CREATE POLICY "inspecoes_fotos_update_owner_gm"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'inspecoes-fotos' AND (auth.uid() = owner OR public.current_is_gm()));

CREATE POLICY "inspecoes_fotos_delete_owner_gm"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'inspecoes-fotos' AND (auth.uid() = owner OR public.current_is_gm()));
