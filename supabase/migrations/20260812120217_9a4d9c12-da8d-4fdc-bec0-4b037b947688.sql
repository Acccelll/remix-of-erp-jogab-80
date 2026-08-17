CREATE POLICY "card_membros_self_delete" ON public.card_membros
FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS setor text;