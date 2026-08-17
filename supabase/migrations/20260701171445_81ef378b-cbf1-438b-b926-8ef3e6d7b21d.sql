CREATE OR REPLACE FUNCTION public.safe_uuid_from_text(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_text IS NULL OR p_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_rdo_fotos_allowed(p_name text, p_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH parsed AS (
    SELECT public.safe_uuid_from_text(split_part(p_name, '/', 1)) AS rdo_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM parsed p
    JOIN public.rdo r ON r.id = p.rdo_id
    WHERE CASE
      WHEN p_write THEN
        public.user_pode_editar_obra(r.obra_id)
        AND (
          public.current_is_gm()
          OR public.current_has_setor('Engenharia')
          OR public.current_has_setor('Producao')
          OR public.current_has_setor('Produção')
        )
      ELSE public.user_em_obra(r.obra_id)
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.storage_inspecoes_fotos_allowed(p_name text, p_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH parsed AS (
    SELECT
      CASE
        WHEN p_name LIKE 'assinaturas/%' THEN 'inspecao'
        WHEN p_name LIKE 'nc-evidencias/%' THEN 'nc'
        ELSE 'inspecao'
      END AS tipo,
      CASE
        WHEN p_name LIKE 'assinaturas/%' THEN public.safe_uuid_from_text(regexp_replace(split_part(p_name, '/', 2), '\.[^.]*$', ''))
        WHEN p_name LIKE 'nc-evidencias/%' THEN NULL
        ELSE public.safe_uuid_from_text(split_part(p_name, '/', 1))
      END AS inspecao_id,
      CASE
        WHEN p_name LIKE 'nc-evidencias/%' THEN public.safe_uuid_from_text(substring(split_part(p_name, '/', 2) from 1 for 36))
        ELSE NULL
      END AS nc_id
  )
  SELECT COALESCE((
    SELECT CASE
      WHEN p.tipo = 'nc' THEN EXISTS (
        SELECT 1
        FROM public.nao_conformidades nc
        WHERE nc.id = p.nc_id
          AND CASE
            WHEN p_write THEN
              public.user_pode_editar_obra(nc.obra_id)
              AND (
                public.current_is_gm()
                OR nc.quem = auth.uid()
                OR nc.created_by = auth.uid()
                OR 'Qualidade' = ANY(public.current_setores())
                OR 'Engenharia' = ANY(public.current_setores())
                OR 'Segurança' = ANY(public.current_setores())
              )
            ELSE
              public.user_em_obra(nc.obra_id)
              AND (
                public.current_is_gm()
                OR nc.quem = auth.uid()
                OR nc.created_by = auth.uid()
                OR 'Qualidade' = ANY(public.current_setores())
                OR 'Engenharia' = ANY(public.current_setores())
                OR 'Segurança' = ANY(public.current_setores())
              )
          END
      )
      ELSE EXISTS (
        SELECT 1
        FROM public.inspecoes i
        WHERE i.id = p.inspecao_id
          AND CASE
            WHEN p_write THEN
              public.user_pode_editar_obra(i.obra_id)
              AND (
                public.current_is_gm()
                OR i.created_by = auth.uid()
                OR i.responsavel_id = auth.uid()
                OR 'Qualidade' = ANY(public.current_setores())
                OR 'Engenharia' = ANY(public.current_setores())
                OR 'Segurança' = ANY(public.current_setores())
              )
            ELSE
              public.user_em_obra(i.obra_id)
              AND (
                public.current_is_gm()
                OR i.created_by = auth.uid()
                OR i.responsavel_id = auth.uid()
                OR 'Qualidade' = ANY(public.current_setores())
                OR 'Engenharia' = ANY(public.current_setores())
                OR 'Segurança' = ANY(public.current_setores())
              )
          END
      )
    END
    FROM parsed p
  ), false);
$$;

-- Posições de cards seguem a permissão do board relacionado.
DROP POLICY IF EXISTS "cbp select" ON public.card_board_posicao;
DROP POLICY IF EXISTS "cbp write" ON public.card_board_posicao;

CREATE POLICY "cbp select por board acessivel"
ON public.card_board_posicao
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = card_board_posicao.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_em_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

CREATE POLICY "cbp write por board editavel"
ON public.card_board_posicao
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = card_board_posicao.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_pode_editar_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = card_board_posicao.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_pode_editar_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

-- Metadados de fotos de RDO seguem a obra do RDO.
DROP POLICY IF EXISTS "rdo_fotos read" ON public.rdo_fotos;
DROP POLICY IF EXISTS "rdo_fotos write" ON public.rdo_fotos;

CREATE POLICY "rdo_fotos read por obra"
ON public.rdo_fotos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_fotos.rdo_id
      AND public.user_em_obra(r.obra_id)
  )
);

CREATE POLICY "rdo_fotos write por obra e setor"
ON public.rdo_fotos
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_fotos.rdo_id
      AND public.user_pode_editar_obra(r.obra_id)
      AND (
        public.current_is_gm()
        OR public.current_has_setor('Engenharia')
        OR public.current_has_setor('Producao')
        OR public.current_has_setor('Produção')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rdo r
    WHERE r.id = rdo_fotos.rdo_id
      AND public.user_pode_editar_obra(r.obra_id)
      AND (
        public.current_is_gm()
        OR public.current_has_setor('Engenharia')
        OR public.current_has_setor('Producao')
        OR public.current_has_setor('Produção')
      )
  )
);

-- Storage de RDO: usa o primeiro segmento do caminho como rdo_id.
DROP POLICY IF EXISTS "rdo-fotos select" ON storage.objects;
DROP POLICY IF EXISTS "rdo-fotos insert" ON storage.objects;
DROP POLICY IF EXISTS "rdo-fotos update" ON storage.objects;
DROP POLICY IF EXISTS "rdo-fotos delete" ON storage.objects;

CREATE POLICY "rdo-fotos select por obra"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'rdo-fotos'
  AND public.storage_rdo_fotos_allowed(name, false)
);

CREATE POLICY "rdo-fotos insert por obra"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rdo-fotos'
  AND auth.uid() = owner
  AND public.storage_rdo_fotos_allowed(name, true)
);

CREATE POLICY "rdo-fotos update por obra"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'rdo-fotos'
  AND public.storage_rdo_fotos_allowed(name, true)
)
WITH CHECK (
  bucket_id = 'rdo-fotos'
  AND public.storage_rdo_fotos_allowed(name, true)
);

CREATE POLICY "rdo-fotos delete por obra"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'rdo-fotos'
  AND public.storage_rdo_fotos_allowed(name, true)
);

-- Storage de inspeções: caminhos suportados: <inspecao_id>/..., assinaturas/<inspecao_id>.png e nc-evidencias/<nc_id>-...
DROP POLICY IF EXISTS "inspecoes_fotos_select_autenticado" ON storage.objects;
DROP POLICY IF EXISTS "inspecoes_fotos_insert_autenticado" ON storage.objects;
DROP POLICY IF EXISTS "inspecoes_fotos_update_owner_gm" ON storage.objects;
DROP POLICY IF EXISTS "inspecoes_fotos_delete_owner_gm" ON storage.objects;

CREATE POLICY "inspecoes_fotos select por acesso"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'inspecoes-fotos'
  AND public.storage_inspecoes_fotos_allowed(name, false)
);

CREATE POLICY "inspecoes_fotos insert por acesso"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inspecoes-fotos'
  AND auth.uid() = owner
  AND public.storage_inspecoes_fotos_allowed(name, true)
);

CREATE POLICY "inspecoes_fotos update por acesso"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inspecoes-fotos'
  AND public.storage_inspecoes_fotos_allowed(name, true)
)
WITH CHECK (
  bucket_id = 'inspecoes-fotos'
  AND public.storage_inspecoes_fotos_allowed(name, true)
);

CREATE POLICY "inspecoes_fotos delete por acesso"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'inspecoes-fotos'
  AND public.storage_inspecoes_fotos_allowed(name, true)
);