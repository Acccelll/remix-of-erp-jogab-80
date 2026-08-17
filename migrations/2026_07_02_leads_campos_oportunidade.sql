-- ============================================================
-- CRM — Campos de oportunidade na tabela leads
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
-- A tela Oportunidades (src/pages/crm/Oportunidades.tsx) já enviava estes
-- campos há tempo, mas a tabela `leads` não tinha as colunas e a API não os
-- gravava — por isso não persistiam. Idempotente: rode só se a coluna ainda
-- não existir.
-- ============================================================

ALTER TABLE leads ADD COLUMN valor_estimado DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN data_prevista_fechamento DATE NULL;
ALTER TABLE leads ADD COLUMN temperatura_temperatura VARCHAR(20) NULL;
ALTER TABLE leads ADD COLUMN contatos JSON NULL;
