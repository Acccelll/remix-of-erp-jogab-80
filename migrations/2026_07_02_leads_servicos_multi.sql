-- ============================================================
-- CRM — Serviços da oportunidade vira seleção múltipla
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
-- A coluna `servico` (texto único) é substituída por `servicos` (JSON
-- com um array de strings). Idempotente: rode só se a coluna ainda não
-- existir. `servico` é mantida (não usada mais) para não perder dado
-- histórico; pode ser removida depois se não houver uso.
-- ============================================================

ALTER TABLE leads ADD COLUMN servicos JSON NULL;
