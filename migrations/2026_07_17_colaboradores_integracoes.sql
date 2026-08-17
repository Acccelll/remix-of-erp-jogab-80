-- ============================================================
-- Migração: adiciona coluna `integracoes` (JSON serializado) em `colaboradores`
-- Data: 2026-07-17
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: a aba "Integrações" do perfil do colaborador nunca foi
-- persistida — o api.php já declara `integracoes` como campo JSON
-- ($jsonFields) mas a coluna não existia e o campo ficava fora da
-- whitelist de escrita. Esta migração cria a coluna; a whitelist e o
-- frontend foram corrigidos no mesmo commit.
-- A tabela `colaborador_integracao` (não utilizada pelo api.php)
-- permanece intocada.

-- LONGTEXT (não JSON): compatível com MySQL < 5.7, mesmo padrão da coluna
-- mobilizacao_pendente. O api.php serializa/desserializa em PHP
-- (json_encode/json_decode) e não depende de funções JSON do MySQL.
-- Idempotente: usa a procedure AddColumnIfNotExists já existente no banco.
CALL AddColumnIfNotExists('colaboradores', 'integracoes', 'LONGTEXT NULL');
