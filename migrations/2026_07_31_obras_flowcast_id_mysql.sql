-- Vínculo entre a obra do backend legado (MySQL) e a obra espelhada no
-- Supabase. Sem esta coluna, a rotina "Reconciliar Vínculos" grava o UUID
-- mas o PHP descarta o campo, e o Dashboard de Obras nunca pareia o
-- cronograma pela chave preferencial (cai no fallback por centro de custo).
ALTER TABLE `obras`
  ADD COLUMN `flowcastId` VARCHAR(36) DEFAULT NULL;

CREATE INDEX `idx_obras_flowcast_id` ON `obras` (`flowcastId`);
