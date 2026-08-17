-- Restringe o bucket privado 'ponto-afd' a GMs.
--
-- O AFD é o arquivo da fiscalização do ponto eletrônico e carrega PIS e CPF de
-- toda a base num arquivo só — acesso mais largo que o estritamente necessário
-- é exposição de dado pessoal sem contrapartida.
--
-- Mesma forma das policies do bucket 'database_export_28_07_26'
-- (20260729135806_*.sql): `is_current_player_gm()` como único gate.
--
-- O bucket em si é criado no painel do Supabase, como os demais deste projeto;
-- aqui vão apenas as policies, que são o que precisa ficar versionado.

CREATE POLICY "ponto_afd_gm_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ponto-afd' AND public.is_current_player_gm());

CREATE POLICY "ponto_afd_gm_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ponto-afd' AND public.is_current_player_gm());

CREATE POLICY "ponto_afd_gm_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ponto-afd' AND public.is_current_player_gm())
  WITH CHECK (bucket_id = 'ponto-afd' AND public.is_current_player_gm());

CREATE POLICY "ponto_afd_gm_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ponto-afd' AND public.is_current_player_gm());
