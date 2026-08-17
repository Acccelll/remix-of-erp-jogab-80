-- ============================================================
-- Migração: Feature Flags e Notificações para MySQL
-- Data: 2026-07-20
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: migrar dados críticos do Supabase para MySQL
-- 1) feature_flags: flags de features controladas por obra
-- 2) notificacoes: sistema de notificações do ERP

-- ============================================================
-- FEATURE FLAGS — configurações por obra e flag_key
-- ============================================================
CREATE TABLE IF NOT EXISTS `feature_flags` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `flag_key` VARCHAR(120) NOT NULL,
  `obra_id` VARCHAR(120) NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `description` TEXT NULL,
  `updated_by` VARCHAR(120) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feature_flags_key_obra` (`flag_key`, `obra_id`),
  KEY `idx_feature_flags_obra` (`obra_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- NOTIFICAÇÕES — sistema de notificações para todos os usuários
-- ============================================================
CREATE TABLE IF NOT EXISTS `notificacoes` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `tipo` VARCHAR(50) NOT NULL,
  `role_scope` VARCHAR(50) NOT NULL,
  `target_id` VARCHAR(120) NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `mensagem` TEXT NULL,
  `autor_login` VARCHAR(120) NULL,
  `autor_id` VARCHAR(120) NULL,
  `user_id` VARCHAR(120) NULL,
  `card_id` VARCHAR(120) NULL,
  `texto` TEXT NULL,
  `lida_por` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notificacoes_role_scope` (`role_scope`),
  KEY `idx_notificacoes_user_id` (`user_id`),
  KEY `idx_notificacoes_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
