-- ============================================================
-- RH — Consolida documentos de colaboradores na tabela `vencimentos`
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
--
-- Bug encontrado: a aba "Documentos" de Colaboradores lê a lista de
-- documentos de `vencimentos` (rota `colaboradores`), mas a rota
-- dedicada de criar/editar/remover um documento (`documentoColaborador`,
-- usada pelo AppContext ao salvar a aba) gravava em `documentos_colaborador`
-- — uma tabela diferente, nunca lida de volta. Resultado: qualquer edição
-- feita na aba Documentos depois do cadastro inicial do colaborador
-- "sumia" ao recarregar a página, mesmo tendo sido gravada (na tabela
-- errada). O código do api.php foi corrigido para gravar e ler sempre
-- de `vencimentos`.
--
-- Esta migration:
-- 1) adiciona `ferias_id` em `vencimentos` (só existia em
--    documentos_colaborador; usada para linkar o documento "Férias" a um
--    registro de férias do colaborador);
-- 2) migra os poucos registros que já foram gravados (perdidos) em
--    `documentos_colaborador` de volta para `vencimentos`, para não
--    perder dado real que o usuário já cadastrou.
--
-- Idempotente: rode só se a coluna ainda não existir; a migração de
-- dados é protegida por NOT EXISTS (não duplica se rodar de novo).
-- `documentos_colaborador` é mantida (sem uso) para não perder histórico.
-- ============================================================

ALTER TABLE vencimentos ADD COLUMN ferias_id VARCHAR(255) NULL;

INSERT INTO vencimentos (colaborador_id, nome_documento, data_vencimento, status_aprovacao, obrigatorio, ferias_id)
SELECT dc.colaborador_id, dc.nome, dc.data_vencimento, dc.status_aprovacao, dc.obrigatorio, dc.ferias_id
FROM documentos_colaborador dc
WHERE NOT EXISTS (
  SELECT 1 FROM vencimentos v
  WHERE v.colaborador_id = dc.colaborador_id AND v.nome_documento = dc.nome
);
