DROP POLICY IF EXISTS fat_nfse_auth_all ON public.faturamento_nfse;
CREATE POLICY "fat_nfse planifik" ON public.faturamento_nfse
  AS PERMISSIVE FOR ALL TO anon, authenticated, service_role
  USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturamento_nfse TO anon;