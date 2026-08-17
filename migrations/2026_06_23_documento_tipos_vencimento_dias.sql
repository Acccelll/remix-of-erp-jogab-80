-- Adiciona campo de vencimento em dias para tipos de documento.
-- Mantém vencimento_meses (se existir) por compatibilidade; novo código grava sempre em dias.
ALTER TABLE documento_tipos
  ADD COLUMN vencimento_dias INT NOT NULL DEFAULT 365;

-- Backfill: converte meses existentes (caso a coluna exista no schema)
-- Se a coluna vencimento_meses não existir, ignore o UPDATE abaixo.
-- UPDATE documento_tipos SET vencimento_dias = COALESCE(vencimento_meses, 12) * 30;
