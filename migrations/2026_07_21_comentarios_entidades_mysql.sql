-- ============================================================
-- Comentários encadeados para Colaboradores, Patrimônios e Contratos
-- Data: 2026-07-21
-- Aplicar no MySQL do host (jogabcom_gestao_obras).
-- ============================================================
-- Replica o padrão de oportunidade_comentarios (CRM) para os três quadros
-- operacionais: um balãozinho com contador em cada card abre um painel de
-- comentários encadeados; cada comentário é persistido com autor e data.
--
-- Sem FK rígida (compatibilidade com o MySQL da hospedagem compartilhada);
-- o vínculo é por <entidade>_id. Idempotente (CREATE TABLE IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS `colaborador_comentarios` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NOT NULL,
  `texto`          TEXT NOT NULL,
  `autor`          VARCHAR(255) NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_colab_coment_colab` (`colaborador_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `patrimonio_comentarios` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `patrimonio_id` INT NOT NULL,
  `texto`         TEXT NOT NULL,
  `autor`         VARCHAR(255) NULL,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_patrim_coment_patrim` (`patrimonio_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `contrato_comentarios` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `contrato_id` INT NOT NULL,
  `texto`       TEXT NOT NULL,
  `autor`       VARCHAR(255) NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contrato_coment_contrato` (`contrato_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
