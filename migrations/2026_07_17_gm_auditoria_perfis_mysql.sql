-- ============================================================
-- Migração: auditoria (logins e alterações) e perfis de permissão no MySQL
-- Data: 2026-07-17
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto (módulo Gerenciamento):
-- 1) audit_logins: logins eram gravados best-effort numa tabela Supabase
--    nunca lida; a aba "Logins" da Auditoria lia só o localStorage do
--    navegador. Passa a persistir aqui, com leitura pela rota auditLogins.
-- 2) audit_logs: trilha de alterações para as mutações do api.php — a
--    auditoria do Supabase (triggers) não enxerga nada que passa pelo
--    trilho MySQL. Gravada pelo helper logAudit() do api.php.
-- 3) perfis_permissao: templates de permissão do GM viviam só em
--    localStorage (TODO slice-02 do PRO-028).
-- Compatível com MySQL < 5.7 (JSON serializado em LONGTEXT).
-- Idempotente: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `audit_logins` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` VARCHAR(64) NOT NULL,
  `login` VARCHAR(100) NOT NULL,
  `nome` VARCHAR(255) DEFAULT NULL,
  `sucesso` TINYINT(1) NOT NULL DEFAULT 1,
  `user_agent` VARCHAR(512) DEFAULT NULL,
  `ip` VARCHAR(64) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logins_user_created` (`user_id`, `created_at`),
  KEY `idx_audit_logins_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- before/after = snapshots JSON serializados (LONGTEXT).
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entidade` VARCHAR(64) NOT NULL,
  `entidade_id` VARCHAR(64) DEFAULT NULL,
  `acao` VARCHAR(16) NOT NULL,
  `before_json` LONGTEXT,
  `after_json` LONGTEXT,
  `user_id` VARCHAR(64) DEFAULT NULL,
  `user_login` VARCHAR(100) DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_entidade` (`entidade`, `entidade_id`),
  KEY `idx_audit_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- id gerado no cliente (ex.: 'perfil_ab12cd34...') — upsert idempotente
-- na reconciliação do legado localStorage.
CREATE TABLE IF NOT EXISTS `perfis_permissao` (
  `id` VARCHAR(64) NOT NULL,
  `nome` VARCHAR(120) NOT NULL,
  `descricao` VARCHAR(255) DEFAULT NULL,
  `acessos` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_perfis_permissao_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
