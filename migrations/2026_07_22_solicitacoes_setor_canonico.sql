-- ============================================================
-- Canoniza o Setor das solicitações financeiras (OPCIONAL)
-- Data: 2026-07-22
-- Aplicar no MySQL do host (jogabcom_gestao_obras).
-- ============================================================
-- A Aprovação Financeira passou a usar a MESMA lista de setores das Permissões
-- (SETORES_SUPABASE em src/lib/authz/paginas.ts): engenharia, dp, financeiro,
-- compras, seguranca, fiscalizacao, qualidade. As solicitações antigas foram
-- gravadas com a lista fixa anterior ("RH", "Compras", "Almoxarifado",
-- "Frotas", "Engenharia").
--
-- Esta migração converte os valores antigos de `solicitacoes_financeiras.setor`
-- para os slugs canônicos, alinhando o filtro de visibilidade por setor.
--
-- É OPCIONAL: o app já normaliza rótulos legados em tempo de leitura
-- (normalizarSetorLegado / setorLabel), então os registros antigos continuam
-- exibidos e filtrados corretamente mesmo sem rodar este script. Rode-o apenas
-- se quiser padronizar os dados gravados. Valores fora do mapa abaixo são
-- deixados intactos (seguem visíveis ao GM).
--
-- Mapa aplicado (revise antes de executar, principalmente RH/Almoxarifado/Frotas):
--   Compras      -> compras
--   Engenharia   -> engenharia
--   RH           -> dp
--   Almoxarifado -> compras
--   Frotas       -> engenharia
--   (+ rótulos canônicos gravados por extenso -> respectivo slug)
-- ============================================================

UPDATE solicitacoes_financeiras SET setor = 'compras'     WHERE LOWER(TRIM(setor)) IN ('compras', 'almoxarifado');
UPDATE solicitacoes_financeiras SET setor = 'engenharia'  WHERE LOWER(TRIM(setor)) IN ('engenharia', 'frotas');
UPDATE solicitacoes_financeiras SET setor = 'dp'          WHERE LOWER(TRIM(setor)) IN ('rh', 'depto. pessoal', 'depto pessoal', 'departamento pessoal');
UPDATE solicitacoes_financeiras SET setor = 'financeiro'  WHERE LOWER(TRIM(setor)) = 'financeiro';
UPDATE solicitacoes_financeiras SET setor = 'seguranca'   WHERE LOWER(TRIM(setor)) IN ('seguranca', 'segurança');
UPDATE solicitacoes_financeiras SET setor = 'fiscalizacao' WHERE LOWER(TRIM(setor)) IN ('fiscalizacao', 'fiscalização');
UPDATE solicitacoes_financeiras SET setor = 'qualidade'   WHERE LOWER(TRIM(setor)) = 'qualidade';

-- Conferência:
-- SELECT setor, COUNT(*) FROM solicitacoes_financeiras GROUP BY setor ORDER BY setor;
