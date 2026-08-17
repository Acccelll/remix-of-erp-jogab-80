GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturamento_nfse TO authenticated;
GRANT ALL ON public.faturamento_nfse TO service_role;
DELETE FROM public.faturamento_nfse WHERE numero_nfse = 'TEST-1';