-- ============================================================
-- DB-004 · Trilho MySQL — controle de estado aplicado
-- Data: 2026-07-14
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- Objetivo: tornar rastreável quais migrações foram aplicadas ao
-- banco legado até o desligamento do trilho MySQL.
-- ============================================================

-- 1. Tabela de controle (idempotente).
CREATE TABLE IF NOT EXISTS schema_migrations (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    filename       VARCHAR(255) NOT NULL,
    checksum_sha256 CHAR(64)     NULL,
    applied_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    applied_by     VARCHAR(120) NULL,
    notes          TEXT         NULL,
    UNIQUE KEY uq_schema_migrations_filename (filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Backfill do histórico conhecido — inserir manualmente cada
--    migração já aplicada em produção. `INSERT IGNORE` evita
--    duplicação se este script for reexecutado.
--    Após rodar em produção, o operador confirma cada linha com
--    o mesmo `applied_by` do host.
INSERT IGNORE INTO schema_migrations (filename, applied_at, applied_by, notes) VALUES
    ('2026_06_19_remix_context.sql',                       NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_06_23_documento_tipos_vencimento_dias.sql',     NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_06_24_crm.sql',                                 NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_06_30_expand_clientes_financeiro.sql',          NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_06_30_fix_clientes_primary_key.sql',            NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_07_02_colaboradores_documentos_consolida_vencimentos.sql', NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_07_02_lead_comentarios.sql',                    NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_07_02_leads_campos_oportunidade.sql',           NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_07_02_leads_local_obra_datas_potenciais.sql',   NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_07_02_leads_servicos_multi.sql',                NOW(), 'backfill', 'DB-004 backfill'),
    ('2026_07_04_rename_leads_para_oportunidades.sql',     NOW(), 'backfill', 'DB-004 backfill');

-- 3. Consulta padrão para conferência.
--    SELECT filename, applied_at, applied_by FROM schema_migrations ORDER BY applied_at;
