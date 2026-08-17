
-- TODO(auth): substituir por policies por membership em card_setores quando
-- Supabase Auth + RLS reais forem decididos no projeto.

CREATE POLICY "card-anexos select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'card-anexos');

CREATE POLICY "card-anexos insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'card-anexos');

CREATE POLICY "card-anexos update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'card-anexos')
  WITH CHECK (bucket_id = 'card-anexos');

CREATE POLICY "card-anexos delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'card-anexos');
