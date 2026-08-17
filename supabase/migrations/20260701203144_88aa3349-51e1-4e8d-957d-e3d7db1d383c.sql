-- Backend hardening: remaining broad-read policies and fragile UUID casts

CREATE OR REPLACE FUNCTION public.safe_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
BEGIN
  RETURN p_text::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.safe_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.safe_uuid(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.safe_uuid(text) TO service_role;

-- Global labels: only GM can mutate shared label definitions.
DROP POLICY IF EXISTS "labels manage" ON public.card_labels;
CREATE POLICY "labels manage gm only"
ON public.card_labels
FOR ALL
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());

-- Collaborators: avoid regex/cast fragility and default-deny invalid obra_atual_id for non-GM users.
DROP POLICY IF EXISTS "colaboradores select rh membro direto ou gm" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores write rh membro direto ou gm" ON public.colaboradores;

CREATE POLICY "colaboradores select rh membro direto ou gm"
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
    )
  )
);

CREATE POLICY "colaboradores write rh membro direto ou gm"
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
        AND om.papel = ANY (ARRAY['gestor'::text, 'membro'::text])
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
        AND om.papel = ANY (ARRAY['gestor'::text, 'membro'::text])
    )
  )
);

-- RDO parent and child records: read/write only for GM or users associated with the obra.
DROP POLICY IF EXISTS "rdo write" ON public.rdo;
CREATE POLICY "rdo write"
ON public.rdo
FOR ALL
TO authenticated
USING (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND public.user_em_obra(obra_id)
)
WITH CHECK (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND public.user_em_obra(obra_id)
);

DROP POLICY IF EXISTS "rdo_atividades read" ON public.rdo_atividades;
DROP POLICY IF EXISTS "rdo_atividades write" ON public.rdo_atividades;
CREATE POLICY "rdo_atividades read"
ON public.rdo_atividades
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_atividades.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);
CREATE POLICY "rdo_atividades write"
ON public.rdo_atividades
FOR ALL
TO authenticated
USING (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_atividades.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
)
WITH CHECK (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_atividades.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);

DROP POLICY IF EXISTS "rdo_efetivo read" ON public.rdo_efetivo;
DROP POLICY IF EXISTS "rdo_efetivo write" ON public.rdo_efetivo;
CREATE POLICY "rdo_efetivo read"
ON public.rdo_efetivo
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_efetivo.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);
CREATE POLICY "rdo_efetivo write"
ON public.rdo_efetivo
FOR ALL
TO authenticated
USING (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_efetivo.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
)
WITH CHECK (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_efetivo.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);

DROP POLICY IF EXISTS "rdo_ocorrencias read" ON public.rdo_ocorrencias;
DROP POLICY IF EXISTS "rdo_ocorrencias write" ON public.rdo_ocorrencias;
CREATE POLICY "rdo_ocorrencias read"
ON public.rdo_ocorrencias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_ocorrencias.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);
CREATE POLICY "rdo_ocorrencias write"
ON public.rdo_ocorrencias
FOR ALL
TO authenticated
USING (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_ocorrencias.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
)
WITH CHECK (
  (public.current_is_gm() OR public.current_has_setor('Engenharia') OR public.current_has_setor('Producao'))
  AND EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_ocorrencias.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);

-- Schedule scenarios and revisions: scope reads to obra membership.
DROP POLICY IF EXISTS "cenarios select" ON public.cronograma_cenarios;
DROP POLICY IF EXISTS "cenarios insert" ON public.cronograma_cenarios;
DROP POLICY IF EXISTS "cenarios update" ON public.cronograma_cenarios;
DROP POLICY IF EXISTS "cenarios delete" ON public.cronograma_cenarios;
CREATE POLICY "cenarios select"
ON public.cronograma_cenarios
FOR SELECT
TO authenticated
USING (public.user_em_obra(obra_id));
CREATE POLICY "cenarios insert"
ON public.cronograma_cenarios
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_em_obra(obra_id)
  AND (auth.uid() = criado_por OR public.current_is_gm())
);
CREATE POLICY "cenarios update"
ON public.cronograma_cenarios
FOR UPDATE
TO authenticated
USING (
  public.user_em_obra(obra_id)
  AND (auth.uid() = criado_por OR public.current_is_gm())
)
WITH CHECK (
  public.user_em_obra(obra_id)
  AND (auth.uid() = criado_por OR public.current_is_gm())
);
CREATE POLICY "cenarios delete"
ON public.cronograma_cenarios
FOR DELETE
TO authenticated
USING (
  public.user_em_obra(obra_id)
  AND (auth.uid() = criado_por OR public.current_is_gm())
);

DROP POLICY IF EXISTS "cronograma_item_revisoes select" ON public.cronograma_item_revisoes;
CREATE POLICY "cronograma_item_revisoes select"
ON public.cronograma_item_revisoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cronograma_itens ci
    WHERE ci.id = cronograma_item_revisoes.cronograma_item_id
      AND public.user_em_obra(ci.obra_id)
  )
);

-- Import metadata: restrict to GM / finance-related sectors.
DROP POLICY IF EXISTS "auth pode ler import runs" ON public.totvs_import_runs;
DROP POLICY IF EXISTS "gm pode registrar import runs" ON public.totvs_import_runs;
CREATE POLICY "financeiro pode ler import runs"
ON public.totvs_import_runs
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
);
CREATE POLICY "financeiro pode registrar import runs"
ON public.totvs_import_runs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.current_is_gm()
    OR public.current_has_setor('Financeiro')
    OR public.current_has_setor('Controladoria')
  )
);

DROP POLICY IF EXISTS "ivr_select_authenticated" ON public.import_validation_runs;
DROP POLICY IF EXISTS "ivr_insert_authenticated" ON public.import_validation_runs;
DROP POLICY IF EXISTS "ivr_update_gm" ON public.import_validation_runs;
CREATE POLICY "ivr_select_financeiro_gm"
ON public.import_validation_runs
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Financeiro')
  OR public.current_has_setor('Controladoria')
  OR public.current_has_setor('Contratos')
);
CREATE POLICY "ivr_insert_financeiro_gm"
ON public.import_validation_runs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = criado_por
  AND (
    public.current_is_gm()
    OR public.current_has_setor('Financeiro')
    OR public.current_has_setor('Controladoria')
    OR public.current_has_setor('Contratos')
  )
);
CREATE POLICY "ivr_update_gm"
ON public.import_validation_runs
FOR UPDATE
TO authenticated
USING (public.current_is_gm())
WITH CHECK (public.current_is_gm());

-- Inspection QR targets: scope to obra membership and ownership.
DROP POLICY IF EXISTS "Authenticated read qr alvos" ON public.inspecao_qr_alvos;
DROP POLICY IF EXISTS "Authenticated insert qr alvos" ON public.inspecao_qr_alvos;
DROP POLICY IF EXISTS "inspecao_qr_alvos update gm or owner" ON public.inspecao_qr_alvos;
DROP POLICY IF EXISTS "inspecao_qr_alvos delete gm or owner" ON public.inspecao_qr_alvos;
CREATE POLICY "inspecao_qr_alvos read obra"
ON public.inspecao_qr_alvos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.user_em_obra(obra_id)
  OR created_by = auth.uid()
);
CREATE POLICY "inspecao_qr_alvos insert obra"
ON public.inspecao_qr_alvos
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.current_is_gm() OR public.user_em_obra(obra_id))
);
CREATE POLICY "inspecao_qr_alvos update gm or owner obra"
ON public.inspecao_qr_alvos
FOR UPDATE
TO authenticated
USING (
  public.current_is_gm()
  OR (created_by = auth.uid() AND public.user_em_obra(obra_id))
)
WITH CHECK (
  public.current_is_gm()
  OR (created_by = auth.uid() AND public.user_em_obra(obra_id))
);
CREATE POLICY "inspecao_qr_alvos delete gm or owner obra"
ON public.inspecao_qr_alvos
FOR DELETE
TO authenticated
USING (
  public.current_is_gm()
  OR (created_by = auth.uid() AND public.user_em_obra(obra_id))
);

-- Indexes for the policies above and the observed board hotspots.
CREATE INDEX IF NOT EXISTS idx_rdo_obra_id ON public.rdo (obra_id);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_rdo_id ON public.rdo_atividades (rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_efetivo_rdo_id ON public.rdo_efetivo (rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_rdo_id ON public.rdo_ocorrencias (rdo_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_cenarios_obra_id ON public.cronograma_cenarios (obra_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_item_revisoes_item_id ON public.cronograma_item_revisoes (cronograma_item_id);
CREATE INDEX IF NOT EXISTS idx_inspecao_qr_alvos_obra_id ON public.inspecao_qr_alvos (obra_id);
CREATE INDEX IF NOT EXISTS idx_inspecao_qr_alvos_created_by ON public.inspecao_qr_alvos (created_by);
CREATE INDEX IF NOT EXISTS idx_card_label_links_card_id ON public.card_label_links (card_id);
CREATE INDEX IF NOT EXISTS idx_card_checklist_itens_card_id ON public.card_checklist_itens (card_id);
CREATE INDEX IF NOT EXISTS idx_card_atividades_card_created ON public.card_atividades (card_id, created_at DESC);