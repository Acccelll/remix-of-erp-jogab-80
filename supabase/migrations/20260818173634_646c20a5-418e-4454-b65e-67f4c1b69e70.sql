-- Restringe o bucket privado 'cnab' (arquivos de remessa/retorno bancário) a
-- Financeiro/GM — mesmo raciocínio do bucket 'ponto-afd'
-- (20260804120000_ponto_afd_bucket_policies.sql): dado sensível (dados
-- bancários de fornecedores, movimentação financeira), acesso mais largo que
-- o estritamente necessário é exposição sem contrapartida.
--
-- O bucket em si é criado no painel do Supabase, como os demais deste
-- projeto; aqui vão apenas as policies, que são o que precisa ficar
-- versionado.

CREATE POLICY "cnab_financeiro_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cnab' AND (public.current_is_gm() OR public.current_has_setor('Financeiro')));

CREATE POLICY "cnab_financeiro_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cnab' AND (public.current_is_gm() OR public.current_has_setor('Financeiro')));

CREATE POLICY "cnab_financeiro_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cnab' AND (public.current_is_gm() OR public.current_has_setor('Financeiro')))
  WITH CHECK (bucket_id = 'cnab' AND (public.current_is_gm() OR public.current_has_setor('Financeiro')));

CREATE POLICY "cnab_financeiro_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cnab' AND (public.current_is_gm() OR public.current_has_setor('Financeiro')));
