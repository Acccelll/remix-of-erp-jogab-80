-- ============================================================
-- CRM — Local da obra e datas potenciais de início/término
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
-- Idempotente: rode só se a coluna ainda não existir.
-- ============================================================

ALTER TABLE leads ADD COLUMN local_obra VARCHAR(255) NULL;
ALTER TABLE leads ADD COLUMN potencial_inicio_obra DATE NULL;
ALTER TABLE leads ADD COLUMN potencial_termino_obra DATE NULL;
