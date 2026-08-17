
-- Restrict access to the private 'database_export_28_07_26' bucket to GMs only
CREATE POLICY "database_export_gm_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'database_export_28_07_26' AND public.is_current_player_gm());

CREATE POLICY "database_export_gm_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'database_export_28_07_26' AND public.is_current_player_gm());

CREATE POLICY "database_export_gm_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'database_export_28_07_26' AND public.is_current_player_gm())
  WITH CHECK (bucket_id = 'database_export_28_07_26' AND public.is_current_player_gm());

CREATE POLICY "database_export_gm_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'database_export_28_07_26' AND public.is_current_player_gm());
