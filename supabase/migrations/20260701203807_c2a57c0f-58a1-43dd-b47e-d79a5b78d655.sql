-- Horizon 0 hardening continuation: replace remaining broad authenticated reads with obra/setor-scoped rules.

-- 1) Highly sensitive HR/PII: require GM or RH gestor directly linked to the collaborator's current obra.
DROP POLICY IF EXISTS "colaboradores select rh membro direto ou gm" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores write rh membro direto ou gm" ON public.colaboradores;

CREATE POLICY "colaboradores select gm ou rh gestor da obra"
ON public.colaboradores
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
);

CREATE POLICY "colaboradores write gm ou rh gestor da obra"
ON public.colaboradores
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
);

-- 2) Supply/board reference data: no more all-authenticated reads.
DROP POLICY IF EXISTS "card_grupos_negociacao select" ON public.card_grupos_negociacao;
CREATE POLICY "card_grupos_negociacao select setores responsaveis"
ON public.card_grupos_negociacao
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
);

DROP POLICY IF EXISTS "labels read" ON public.card_labels;
CREATE POLICY "labels read setores operacionais"
ON public.card_labels
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Produção')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Qualidade')
  OR public.current_has_setor('Segurança')
  OR public.current_has_setor('Seguranca')
  OR public.current_has_setor('RH')
);

DROP POLICY IF EXISTS "ccf_select" ON public.card_custom_fields;
CREATE POLICY "ccf_select setores operacionais"
ON public.card_custom_fields
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Produção')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Qualidade')
  OR public.current_has_setor('Financeiro')
);

-- 3) Financial/reference configuration.
DROP POLICY IF EXISTS "alcadas_aprovacao read" ON public.alcadas_aprovacao;
CREATE POLICY "alcadas_aprovacao read financeiro compras gm"
ON public.alcadas_aprovacao
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Suprimentos')
);

DROP POLICY IF EXISTS "cct_select" ON public.centros_custo_totvs;
CREATE POLICY "cct_select financeiro ou obra"
ON public.centros_custo_totvs
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
  OR (obra_id IS NOT NULL AND public.user_em_obra(obra_id))
);

DROP POLICY IF EXISTS "pc_select" ON public.plano_contas;
CREATE POLICY "pc_select financeiro"
ON public.plano_contas
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
);

DROP POLICY IF EXISTS "fp_select" ON public.formas_pagamento;
CREATE POLICY "fp_select financeiro compras"
ON public.formas_pagamento
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Suprimentos')
);

DROP POLICY IF EXISTS "feature_flags_select_authenticated" ON public.feature_flags;
CREATE POLICY "feature_flags_select_gm"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (public.current_is_gm());

-- 4) Operational reference tables.
DROP POLICY IF EXISTS "funcoes read all" ON public.funcoes;
CREATE POLICY "funcoes read setores operacionais rh"
ON public.funcoes
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('RH')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Produção')
  OR public.current_has_setor('Qualidade')
  OR public.current_has_setor('Segurança')
  OR public.current_has_setor('Seguranca')
);

DROP POLICY IF EXISTS "documento_tipos read all" ON public.documento_tipos;
CREATE POLICY "documento_tipos read setores responsaveis"
ON public.documento_tipos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('RH')
  OR public.current_has_setor('Qualidade')
  OR public.current_has_setor('Segurança')
  OR public.current_has_setor('Seguranca')
  OR public.current_has_setor('Engenharia')
);

DROP POLICY IF EXISTS "lead_time_templates select" ON public.lead_time_templates;
CREATE POLICY "lead_time_templates select obra ou suprimentos"
ON public.lead_time_templates
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Engenharia')
  OR (obra_id IS NOT NULL AND public.user_em_obra(obra_id))
);

DROP POLICY IF EXISTS "obra_loc read" ON public.obra_localizacoes;
CREATE POLICY "obra_loc read por obra"
ON public.obra_localizacoes
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.user_em_obra(obra_id)
  OR public.current_has_setor('Engenharia')
);

-- 5) Fleet, assets, risks, incidents and lessons learned.
DROP POLICY IF EXISTS "veiculos read all" ON public.veiculos;
CREATE POLICY "veiculos read obra ou setores operacionais"
ON public.veiculos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('RH')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Compras')
  OR (public.safe_uuid(obra_atual_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_atual_id)))
);

DROP POLICY IF EXISTS "patrimonios read all" ON public.patrimonios;
CREATE POLICY "patrimonios read obra ou setores operacionais"
ON public.patrimonios
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('RH')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Compras')
  OR (public.safe_uuid(obra_atual_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_atual_id)))
);

DROP POLICY IF EXISTS "responsabilidades_patrimonios read all" ON public.responsabilidades_patrimonios;
CREATE POLICY "responsabilidades_patrimonios read por patrimonio ou rh"
ON public.responsabilidades_patrimonios
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('RH')
  OR EXISTS (
    SELECT 1
    FROM public.patrimonios p
    WHERE p.id::text = responsabilidades_patrimonios.patrimonio_id
      AND public.safe_uuid(p.obra_atual_id) IS NOT NULL
      AND public.user_em_obra(public.safe_uuid(p.obra_atual_id))
  )
);

DROP POLICY IF EXISTS "mobilizacoes_periodos read all" ON public.mobilizacoes_periodos;
CREATE POLICY "mobilizacoes_periodos read por obra ou rh"
ON public.mobilizacoes_periodos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND (
      (public.safe_uuid(obra_id) IS NULL AND public.safe_uuid(from_obra_id) IS NULL)
      OR (public.safe_uuid(obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_id)))
      OR (public.safe_uuid(from_obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(from_obra_id)))
    )
  )
  OR (public.safe_uuid(obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_id)))
  OR (public.safe_uuid(from_obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(from_obra_id)))
);

DROP POLICY IF EXISTS "mobilizacoes_veiculos read all" ON public.mobilizacoes_veiculos;
CREATE POLICY "mobilizacoes_veiculos read por obra ou setores"
ON public.mobilizacoes_veiculos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('RH')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Suprimentos')
  OR public.current_has_setor('Compras')
  OR (public.safe_uuid(obra_id) IS NOT NULL AND public.user_em_obra(public.safe_uuid(obra_id)))
);

DROP POLICY IF EXISTS "riscos read all" ON public.riscos;
CREATE POLICY "riscos read por obra"
ON public.riscos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.user_em_obra(obra_id)
);

DROP POLICY IF EXISTS "riscos write gm" ON public.riscos;
CREATE POLICY "riscos write por obra e setor"
ON public.riscos
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.user_em_obra(obra_id)
    AND (
      public.current_has_setor('Engenharia')
      OR public.current_has_setor('Qualidade')
      OR public.current_has_setor('Segurança')
      OR public.current_has_setor('Seguranca')
      OR public.current_has_setor('Producao')
      OR public.current_has_setor('Produção')
    )
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.user_em_obra(obra_id)
    AND (
      public.current_has_setor('Engenharia')
      OR public.current_has_setor('Qualidade')
      OR public.current_has_setor('Segurança')
      OR public.current_has_setor('Seguranca')
      OR public.current_has_setor('Producao')
      OR public.current_has_setor('Produção')
    )
  )
);

DROP POLICY IF EXISTS "ocorrencias read all" ON public.ocorrencias;
CREATE POLICY "ocorrencias read por obra"
ON public.ocorrencias
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.user_em_obra(obra_id)
);

DROP POLICY IF EXISTS "ocorrencias write gm" ON public.ocorrencias;
CREATE POLICY "ocorrencias write por obra e setor"
ON public.ocorrencias
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.user_em_obra(obra_id)
    AND (
      public.current_has_setor('Engenharia')
      OR public.current_has_setor('Qualidade')
      OR public.current_has_setor('Segurança')
      OR public.current_has_setor('Seguranca')
      OR public.current_has_setor('Producao')
      OR public.current_has_setor('Produção')
    )
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.user_em_obra(obra_id)
    AND (
      public.current_has_setor('Engenharia')
      OR public.current_has_setor('Qualidade')
      OR public.current_has_setor('Segurança')
      OR public.current_has_setor('Seguranca')
      OR public.current_has_setor('Producao')
      OR public.current_has_setor('Produção')
    )
  )
);

DROP POLICY IF EXISTS "licoes_aprendidas read all" ON public.licoes_aprendidas;
CREATE POLICY "licoes_aprendidas read por obra"
ON public.licoes_aprendidas
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.user_em_obra(obra_id)
);

DROP POLICY IF EXISTS "licoes_aprendidas write gm" ON public.licoes_aprendidas;
CREATE POLICY "licoes_aprendidas write por obra e setor"
ON public.licoes_aprendidas
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.user_em_obra(obra_id)
    AND (
      public.current_has_setor('Engenharia')
      OR public.current_has_setor('Qualidade')
      OR public.current_has_setor('Segurança')
      OR public.current_has_setor('Seguranca')
      OR public.current_has_setor('Producao')
      OR public.current_has_setor('Produção')
    )
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.user_em_obra(obra_id)
    AND (
      public.current_has_setor('Engenharia')
      OR public.current_has_setor('Qualidade')
      OR public.current_has_setor('Segurança')
      OR public.current_has_setor('Seguranca')
      OR public.current_has_setor('Producao')
      OR public.current_has_setor('Produção')
    )
  )
);

-- 6) Policy performance support for text obra IDs and frequent filters.
CREATE INDEX IF NOT EXISTS idx_veiculos_obra_atual_safe ON public.veiculos ((public.safe_uuid(obra_atual_id))) WHERE obra_atual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patrimonios_obra_atual_safe ON public.patrimonios ((public.safe_uuid(obra_atual_id))) WHERE obra_atual_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mobilizacoes_periodos_obra_safe ON public.mobilizacoes_periodos ((public.safe_uuid(obra_id))) WHERE obra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mobilizacoes_periodos_from_obra_safe ON public.mobilizacoes_periodos ((public.safe_uuid(from_obra_id))) WHERE from_obra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mobilizacoes_veiculos_obra_safe ON public.mobilizacoes_veiculos ((public.safe_uuid(obra_id))) WHERE obra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_responsabilidades_patrimonio_id_text ON public.responsabilidades_patrimonios (patrimonio_id);
CREATE INDEX IF NOT EXISTS idx_riscos_obra_id ON public.riscos (obra_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_obra_id ON public.ocorrencias (obra_id);
CREATE INDEX IF NOT EXISTS idx_licoes_aprendidas_obra_id ON public.licoes_aprendidas (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_localizacoes_obra_id ON public.obra_localizacoes (obra_id);
CREATE INDEX IF NOT EXISTS idx_lead_time_templates_obra_id ON public.lead_time_templates (obra_id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_totvs_obra_id ON public.centros_custo_totvs (obra_id);