-- Adiciona `previsao` (valor provisório) em solicitacoes_financeiras
-- Espelha a coluna criada no MySQL por migrations/2026_08_13_solicitacoes_previsao.sql,
-- mantendo a paridade que `pagamento_pendente` já tem entre os dois trilhos.
ALTER TABLE public.solicitacoes_financeiras ADD COLUMN IF NOT EXISTS previsao boolean NOT NULL DEFAULT false;
