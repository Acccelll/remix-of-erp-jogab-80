
-- Policies de storage para o bucket privado card-anexos.
-- Convenção: object name começa com '<card_id>/'. Acesso = has_card_access(card_id).

CREATE POLICY "card-anexos: leitura por setor do card"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'card-anexos'
  AND public.has_card_access((split_part(name, '/', 1))::uuid)
);

CREATE POLICY "card-anexos: upload por setor do card"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'card-anexos'
  AND public.has_card_access((split_part(name, '/', 1))::uuid)
);

CREATE POLICY "card-anexos: delete por setor do card"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'card-anexos'
  AND public.has_card_access((split_part(name, '/', 1))::uuid)
);
