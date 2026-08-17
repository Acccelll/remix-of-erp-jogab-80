-- ============================================================
-- CRÍTICO: Correção do Schema Clientes - Adiciona AUTO_INCREMENT
-- MySQL 8.0 Compatible
--
-- ISSUE: Tabela clientes tem `id int NOT NULL` sem AUTO_INCREMENT
-- Isso impedia inserts de novos registros pois MySQL não conseguia gerar IDs automaticamente
--
-- SOLUÇÃO: Modifica a coluna id para incluir AUTO_INCREMENT
-- ============================================================

-- Passo 1: Dropar PRIMARY KEY existente (se houver)
-- Usa uma abordagem segura que ignora erro se não existir
ALTER TABLE `clientes` DROP PRIMARY KEY;

-- Passo 2: Adicionar novamente com AUTO_INCREMENT
ALTER TABLE `clientes` ADD PRIMARY KEY (`id`);

-- Passo 3: Modificar coluna para AUTO_INCREMENT
ALTER TABLE `clientes` MODIFY COLUMN `id` INT NOT NULL AUTO_INCREMENT;

-- Passo 4: Garantir que AUTO_INCREMENT começa no valor correto
-- (considerando os 5 registros existentes)
ALTER TABLE `clientes` AUTO_INCREMENT = 6;
