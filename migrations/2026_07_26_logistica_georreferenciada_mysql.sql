-- ============================================================
-- Migração: georreferenciamento de obras e colaboradores (logística)
-- Data: 2026-07-26
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: a tela "Logística de Colaboradores" (/rh/logistica) posiciona
-- colaboradores e obras num mapa para apoiar a decisão de mobilização.
-- Hoje só existe `colaboradores.cidade` e o texto livre `obras.local`,
-- insuficientes como fonte de verdade — `local` não tem formato garantido
-- e não há onde gravar a posição exata quando o usuário ajusta o pin.
--
-- Todas as colunas são NULL: nenhuma linha existente quebra, e o api.php
-- detecta a presença delas via SHOW COLUMNS antes de lê-las/escrevê-las,
-- de modo que o backend continua funcionando em bancos sem esta migração.
--
-- Precisão: DECIMAL(10,7) cobre o intervalo de latitude/longitude com
-- ~1 cm de resolução, mais que suficiente e livre do erro de arredondamento
-- de FLOAT/DOUBLE em comparações.

-- ── Colunas ──────────────────────────────────────────────────
-- Idempotente: usa a procedure AddColumnIfNotExists já existente no banco
-- (mesmo padrão de 2026_07_17_colaboradores_integracoes.sql).
CALL AddColumnIfNotExists('obras', 'cidade',    'VARCHAR(120) NULL');
CALL AddColumnIfNotExists('obras', 'uf',        'CHAR(2) NULL');
CALL AddColumnIfNotExists('obras', 'latitude',  'DECIMAL(10,7) NULL');
CALL AddColumnIfNotExists('obras', 'longitude', 'DECIMAL(10,7) NULL');

CALL AddColumnIfNotExists('colaboradores', 'uf',        'CHAR(2) NULL');
CALL AddColumnIfNotExists('colaboradores', 'latitude',  'DECIMAL(10,7) NULL');
CALL AddColumnIfNotExists('colaboradores', 'longitude', 'DECIMAL(10,7) NULL');

-- ── Índices ──────────────────────────────────────────────────
-- Não existe procedure AddIndexIfNotExists no banco; a guarda é feita
-- com information_schema + SQL dinâmico para manter a reexecução segura.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE table_schema = DATABASE()
               AND table_name   = 'obras'
               AND index_name   = 'idx_obras_cidade_uf');
SET @sql := IF(@idx = 0,
               'ALTER TABLE obras ADD INDEX idx_obras_cidade_uf (cidade, uf)',
               'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE table_schema = DATABASE()
               AND table_name   = 'colaboradores'
               AND index_name   = 'idx_colaboradores_cidade_uf');
SET @sql := IF(@idx = 0,
               'ALTER TABLE colaboradores ADD INDEX idx_colaboradores_cidade_uf (cidade, uf)',
               'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
