-- ============================================================
-- Expansão de Clientes para Módulo Financeiro
-- Adiciona campos de endereço, prazos comerciais e alíquotas
-- MySQL 8.0 Compatible (sem IF NOT EXISTS)
-- ============================================================

-- Campos de endereço
ALTER TABLE `clientes` ADD COLUMN `nome_fantasia` VARCHAR(255) NULL;
ALTER TABLE `clientes` ADD COLUMN `telefone` VARCHAR(20) NULL;
ALTER TABLE `clientes` ADD COLUMN `cep` VARCHAR(10) NULL;
ALTER TABLE `clientes` ADD COLUMN `logradouro` VARCHAR(255) NULL;
ALTER TABLE `clientes` ADD COLUMN `numero` VARCHAR(10) NULL;
ALTER TABLE `clientes` ADD COLUMN `complemento` VARCHAR(255) NULL;
ALTER TABLE `clientes` ADD COLUMN `bairro` VARCHAR(100) NULL;
ALTER TABLE `clientes` ADD COLUMN `municipio` VARCHAR(100) NULL;
ALTER TABLE `clientes` ADD COLUMN `uf` CHAR(2) NULL;

-- Prazos comerciais
ALTER TABLE `clientes` ADD COLUMN `prazo_pagamento_dias` INT NULL;
ALTER TABLE `clientes` ADD COLUMN `dias_fixos_pagamento` JSON NULL;
ALTER TABLE `clientes` ADD COLUMN `prazo_emitir_nf_dias` INT NULL;

-- Alíquotas/Retenções (com defaults)
ALTER TABLE `clientes` ADD COLUMN `percentual_material` DECIMAL(5,2) NULL DEFAULT 70;
ALTER TABLE `clientes` ADD COLUMN `aliquota_iss` DECIMAL(5,2) NULL DEFAULT 5;
ALTER TABLE `clientes` ADD COLUMN `aliquota_inss` DECIMAL(5,2) NULL DEFAULT 11;
ALTER TABLE `clientes` ADD COLUMN `aliquota_cbs` DECIMAL(5,2) NULL DEFAULT 0;
ALTER TABLE `clientes` ADD COLUMN `aliquota_ibs` DECIMAL(5,2) NULL DEFAULT 0;

-- Observações gerais
ALTER TABLE `clientes` ADD COLUMN `observacoes` TEXT NULL;
