-- ============================================================
-- Migração: suporte ao novo AppContext do remix
-- Data: 2026-06-19
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================

-- 1. Novos campos em obras (dados de pagamento e configuração)
-- Execute cada ALTER separadamente; ignore erros "Duplicate column name" se já existir.
ALTER TABLE `obras` ADD COLUMN `cnpj`                  VARCHAR(20)  DEFAULT NULL AFTER `data_criacao`;
ALTER TABLE `obras` ADD COLUMN `prazo_padrao_pagamento` VARCHAR(100) DEFAULT NULL AFTER `cnpj`;
ALTER TABLE `obras` ADD COLUMN `dia_fixo_pagamento_1`   VARCHAR(10)  DEFAULT NULL AFTER `prazo_padrao_pagamento`;
ALTER TABLE `obras` ADD COLUMN `dia_fixo_pagamento_2`   VARCHAR(10)  DEFAULT NULL AFTER `dia_fixo_pagamento_1`;
ALTER TABLE `obras` ADD COLUMN `data_corte_medicao_1`   VARCHAR(10)  DEFAULT NULL AFTER `dia_fixo_pagamento_2`;
ALTER TABLE `obras` ADD COLUMN `data_corte_medicao_2`   VARCHAR(10)  DEFAULT NULL AFTER `data_corte_medicao_1`;
ALTER TABLE `obras` ADD COLUMN `observacao`             TEXT         DEFAULT NULL AFTER `data_corte_medicao_2`;

-- 2. Novos campos em veiculos (manutenção e sujeira)
ALTER TABLE `veiculos` ADD COLUMN `manutencao` TINYINT(1) NOT NULL DEFAULT 0 AFTER `quebrado`;
ALTER TABLE `veiculos` ADD COLUMN `sujo`       TINYINT(1) NOT NULL DEFAULT 0 AFTER `manutencao`;

-- Sincroniza manutencao com quebrado existente (quebrado era usado como manutenção no sistema anterior)
UPDATE `veiculos` SET `manutencao` = `quebrado` WHERE `manutencao` = 0 AND `quebrado` = 1;
