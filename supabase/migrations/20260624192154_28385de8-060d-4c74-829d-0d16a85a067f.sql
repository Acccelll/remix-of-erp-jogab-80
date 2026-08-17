
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obras','cronograma_itens','cronograma_revisoes','cronograma_item_revisoes',
    'cronograma_marcos','cronograma_baselines','cronograma_item_baseline',
    'cronograma_dependencias','cronograma_calendarios','cronograma_calendario_excecoes',
    'aditivos_contrato'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Drop old open policies
DROP POLICY IF EXISTS "Allow all access to obras" ON public.obras;
DROP POLICY IF EXISTS "cronograma_itens planifik" ON public.cronograma_itens;
DROP POLICY IF EXISTS "cronograma_revisoes planifik" ON public.cronograma_revisoes;
DROP POLICY IF EXISTS "cronograma_item_revisoes planifik" ON public.cronograma_item_revisoes;
DROP POLICY IF EXISTS "cronograma_marcos planifik" ON public.cronograma_marcos;
DROP POLICY IF EXISTS "cronograma_baselines planifik" ON public.cronograma_baselines;
DROP POLICY IF EXISTS "cronograma_item_baseline planifik" ON public.cronograma_item_baseline;
DROP POLICY IF EXISTS "cronograma_dependencias planifik" ON public.cronograma_dependencias;
DROP POLICY IF EXISTS "cronograma_calendarios planifik" ON public.cronograma_calendarios;
DROP POLICY IF EXISTS "cronograma_calendario_excecoes planifik" ON public.cronograma_calendario_excecoes;
DROP POLICY IF EXISTS "aditivos_contrato planifik" ON public.aditivos_contrato;

-- Recreate: SELECT all authenticated, write GM-only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'obras','cronograma_itens','cronograma_revisoes','cronograma_item_revisoes',
    'cronograma_marcos','cronograma_baselines','cronograma_item_baseline',
    'cronograma_dependencias','cronograma_calendarios','cronograma_calendario_excecoes',
    'aditivos_contrato'
  ]
  LOOP
    EXECUTE format($f$CREATE POLICY "%1$s select" ON public.%1$I FOR SELECT TO authenticated USING (true)$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s write" ON public.%1$I FOR ALL TO authenticated USING (public.current_is_gm()) WITH CHECK (public.current_is_gm())$f$, t);
  END LOOP;
END $$;
