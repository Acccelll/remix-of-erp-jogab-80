
-- FK necessária para PostgREST embutir itens_medicao -> cronograma_itens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='itens_medicao'
      AND constraint_type='FOREIGN KEY' AND constraint_name='itens_medicao_cronograma_item_id_fkey'
  ) THEN
    ALTER TABLE public.itens_medicao
      ADD CONSTRAINT itens_medicao_cronograma_item_id_fkey
      FOREIGN KEY (cronograma_item_id) REFERENCES public.cronograma_itens(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Stub idempotente para fn_atualizar_cpm (evita 404 no cliente).
CREATE OR REPLACE FUNCTION public.fn_atualizar_cpm(p_obra_id uuid, p_resultados jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF p_resultados IS NULL OR jsonb_typeof(p_resultados) <> 'array' THEN RETURN; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_resultados) LOOP
    UPDATE public.cronograma_itens
       SET data_inicio_cpm = NULLIF(r->>'data_inicio_cpm','')::timestamptz,
           data_fim_cpm    = NULLIF(r->>'data_fim_cpm','')::timestamptz,
           folga_total     = NULLIF(r->>'folga_total','')::numeric,
           caminho_critico = COALESCE((r->>'caminho_critico')::boolean, false)
     WHERE obra_id = p_obra_id
       AND id = (r->>'item_id')::uuid;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_atualizar_cpm(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_atualizar_cpm(uuid, jsonb) TO authenticated, service_role;

-- Colunas usadas pelo stub (idempotente).
ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS data_inicio_cpm timestamptz,
  ADD COLUMN IF NOT EXISTS data_fim_cpm    timestamptz,
  ADD COLUMN IF NOT EXISTS folga_total     numeric,
  ADD COLUMN IF NOT EXISTS caminho_critico boolean DEFAULT false;

-- Força reload do schema cache do PostgREST (após ALTERs em cronograma_dependencias e afins).
NOTIFY pgrst, 'reload schema';
