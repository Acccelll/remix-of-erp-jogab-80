-- ============================================================
-- Migração: marca solicitação financeira cujo valor é provisório
-- Data: 2026-08-13
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: a solicitação não tinha como declarar que o valor ainda não está
-- fechado. Quem solicita às vezes só tem uma estimativa, e o financeiro trata
-- o número como definitivo porque nada na fila diz o contrário. Com a coluna,
-- a tela destaca a linha em âmbar e sinaliza para os dois lados.
--
-- O nome da coluna é `previsao`; na interface o rótulo é "Valor previsto",
-- para não colidir com o "Previsto" que o módulo já usa em Fluxo de Dívidas e
-- em Previsão de Pagamento, onde significa dívida ainda não paga.
--
-- Reversão: coluna aditiva com DEFAULT. Basta removê-la — o api.php só a lê
-- e escreve quando ela existe no payload, e o front trata ausente como false.

-- Idempotente: usa a procedure AddColumnIfNotExists já existente no banco.
-- TINYINT(1) NOT NULL DEFAULT 0 é o padrão de booleano deste banco.
CALL AddColumnIfNotExists('solicitacoes_financeiras', 'previsao', 'TINYINT(1) NOT NULL DEFAULT 0');

-- Sem backfill: nenhuma solicitação existente é previsão.
