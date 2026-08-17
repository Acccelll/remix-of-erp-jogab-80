ALTER TABLE public.compromissos_semanais
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS causa_chave text,
  ADD COLUMN IF NOT EXISTS causa_detalhe text;
UPDATE public.compromissos_semanais
   SET causa_chave = COALESCE(causa_chave, causa_nao_conclusao);