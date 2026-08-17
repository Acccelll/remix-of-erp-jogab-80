-- ============================================================
-- Migração: persistência do módulo DP no MySQL (holerites, ponto, fechamento)
-- Data: 2026-07-17
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: o módulo DP persistia no Supabase (dp_holerite,
-- ponto_importacoes, ponto_registros, dp_fechamento_competencia).
-- Esta migração cria as tabelas equivalentes no MySQL para o api.php
-- assumir a persistência. Compatível com MySQL < 5.7: sem tipo JSON
-- (verbas em LONGTEXT serializado), sem colunas geradas (custo_total e
-- fator_k são calculados pelo api.php na escrita) e sem índice parcial
-- (unicidade de fechamento ativo é garantida pela rota).
-- A tabela custo_colaborador_competencia NÃO é migrada: é compartilhada
-- com o Financeiro (EVM/AC-folha) e permanece no Supabase.
-- Idempotente: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE VIEW.

CREATE TABLE IF NOT EXISTS `dp_holerite` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tipo` VARCHAR(20) NOT NULL DEFAULT 'holerite',
  `colaborador_id` VARCHAR(64) DEFAULT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `competencia` CHAR(7) NOT NULL,
  `nome_lido` VARCHAR(255) DEFAULT NULL,
  `matricula_lida` VARCHAR(50) DEFAULT NULL,
  `cargo_lido` VARCHAR(255) DEFAULT NULL,
  `centro_custo_nome_lido` VARCHAR(255) DEFAULT NULL,
  `admissao` DATE DEFAULT NULL,
  `proventos` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `descontos` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `liquido` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `base_inss` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `inss` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `base_irrf` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `irrf` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `base_fgts` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `fgts` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `provisao_13` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `inss_provisao_13` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `fgts_provisao_13` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `provisao_ferias` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `inss_provisao_ferias` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `fgts_provisao_ferias` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `inss_empresa` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `rat` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `inss_terceiros` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `salario_base` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `horas_extras_valor` DECIMAL(14,2) NOT NULL DEFAULT 0,
  -- Calculadas pelo api.php na escrita:
  -- custo_total = proventos + inss_empresa + rat + inss_terceiros + fgts
  --             + provisao_13 + provisao_ferias
  -- fator_k     = custo_total / salario_base (NULL se salario_base <= 0)
  `custo_total` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `fator_k` DECIMAL(14,6) DEFAULT NULL,
  `verbas` LONGTEXT,
  `origem` VARCHAR(30) NOT NULL DEFAULT 'holerite_xls',
  `imported_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dp_holerite_cpf_comp_tipo` (`cpf`, `competencia`, `tipo`),
  KEY `idx_dp_holerite_competencia` (`competencia`),
  KEY `idx_dp_holerite_colaborador` (`colaborador_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ponto_importacoes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `arquivo_nome` VARCHAR(255) NOT NULL,
  `periodo_inicio` DATE NOT NULL,
  `periodo_fim` DATE NOT NULL,
  `total_registros` INT NOT NULL DEFAULT 0,
  `total_colaboradores` INT NOT NULL DEFAULT 0,
  `importado_por` VARCHAR(100) DEFAULT NULL,
  `importado_em` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ponto_import_periodo` (`periodo_inicio`, `periodo_fim`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- colaborador_id/obra_id em VARCHAR(64) sem FK: os IDs vêm do cadastro
-- MySQL (INT como texto), mas dados migrados do Supabase podem carregar
-- UUIDs legados. A remoção em cascata por importação é preservada.
CREATE TABLE IF NOT EXISTS `ponto_registros` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `importacao_id` INT NOT NULL,
  `colaborador_id` VARCHAR(64) DEFAULT NULL,
  `nome_csv` VARCHAR(255) NOT NULL DEFAULT '',
  `matricula_csv` VARCHAR(50) DEFAULT NULL,
  `cpf_csv` VARCHAR(14) DEFAULT NULL,
  `departamento_csv` VARCHAR(255) DEFAULT NULL,
  `obra_id` VARCHAR(64) DEFAULT NULL,
  `centro_indireto` TINYINT(1) NOT NULL DEFAULT 0,
  `agregado` TINYINT(1) NOT NULL DEFAULT 0,
  `data` DATE NOT NULL,
  `horas_previstas_min` INT NOT NULL DEFAULT 0,
  `horas_trabalhadas_min` INT NOT NULL DEFAULT 0,
  `horas_falta_min` INT NOT NULL DEFAULT 0,
  `dias_falta_qtd` INT NOT NULL DEFAULT 0,
  `horas_extra_50_min` INT NOT NULL DEFAULT 0,
  `horas_extra_60_min` INT NOT NULL DEFAULT 0,
  `horas_extra_100_min` INT NOT NULL DEFAULT 0,
  `horas_compensadas_min` INT NOT NULL DEFAULT 0,
  `interjornada_min` INT NOT NULL DEFAULT 0,
  `banco_saldo_min` INT NOT NULL DEFAULT 0,
  `marcacao_invalida` TINYINT(1) NOT NULL DEFAULT 0,
  `falta` TINYINT(1) NOT NULL DEFAULT 0,
  `atestado` TINYINT(1) NOT NULL DEFAULT 0,
  `observacao` TEXT,
  PRIMARY KEY (`id`),
  KEY `idx_ponto_reg_importacao` (`importacao_id`),
  KEY `idx_ponto_reg_colab_data` (`colaborador_id`, `data`),
  KEY `idx_ponto_reg_obra_data` (`obra_id`, `data`),
  KEY `idx_ponto_reg_data` (`data`),
  CONSTRAINT `fk_ponto_reg_importacao` FOREIGN KEY (`importacao_id`)
    REFERENCES `ponto_importacoes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Unicidade de "fechamento ativo" (reaberto_em IS NULL) por competência é
-- garantida pela rota dpFechamentoCompetencia do api.php (índice parcial
-- não existe em MySQL).
CREATE TABLE IF NOT EXISTS `dp_fechamento_competencia` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `competencia` CHAR(7) NOT NULL,
  `fechado_em` DATETIME NOT NULL,
  `fechado_por` VARCHAR(100) NOT NULL,
  `motivo` TEXT,
  `reaberto_em` DATETIME DEFAULT NULL,
  `reaberto_por` VARCHAR(100) DEFAULT NULL,
  `motivo_reabertura` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dp_fech_competencia` (`competencia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Réplica da vw_homem_hora_mensal do Supabase (agregação do ponto).
CREATE OR REPLACE VIEW `vw_homem_hora_mensal` AS
SELECT
  pr.colaborador_id,
  pr.obra_id,
  DATE_FORMAT(pr.data, '%Y-%m') AS competencia,
  COUNT(*) AS dias,
  SUM(pr.horas_previstas_min) AS horas_previstas_min,
  SUM(pr.horas_trabalhadas_min) AS horas_realizadas_min,
  SUM(pr.horas_falta_min) AS horas_falta_min,
  SUM(pr.horas_extra_50_min) AS horas_extra_50_min,
  SUM(pr.horas_extra_60_min) AS horas_extra_60_min,
  SUM(pr.horas_extra_100_min) AS horas_extra_100_min,
  SUM(pr.horas_extra_50_min + pr.horas_extra_60_min + pr.horas_extra_100_min) AS horas_extra_total_min,
  SUM(CASE WHEN pr.falta = 1 THEN 1 ELSE 0 END) AS dias_falta,
  SUM(CASE WHEN pr.marcacao_invalida = 1 THEN 1 ELSE 0 END) AS dias_marcacao_invalida
FROM `ponto_registros` pr
GROUP BY pr.colaborador_id, pr.obra_id, DATE_FORMAT(pr.data, '%Y-%m');
