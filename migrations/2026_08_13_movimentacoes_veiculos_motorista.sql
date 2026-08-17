-- ============================================================
-- Migração: registra motorista de origem/destino nas movimentações de veículo
-- Data: 2026-08-13
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: `veiculos` não tem coluna `historico` — o api.php descarta o campo
-- no PUT e reconstrói o histórico a cada leitura a partir de
-- `movimentacoes_veiculos`, que só guarda obra de origem/destino. O api.php já
-- grava uma linha a cada troca de `motorista_id`, mas sem dizer quem dirigia:
-- só sobra a transição de obra derivada do novo motorista, indistinguível de
-- uma mobilização comum — e, quando os dois motoristas estão na mesma obra,
-- vira uma linha com origem e destino idênticos.
--
-- A Gestão de Equipe passou a perguntar, ao mobilizar um colaborador com carro
-- atrelado, se o veículo foi junto ou ficou com outro motorista. Sem estas
-- colunas essa decisão não deixa rastro de quem assumiu o carro.
--
-- Reversão: colunas aditivas e NULL. Basta removê-las; o api.php detecta a
-- ausência via SHOW COLUMNS (`temMotoristaEmMovimentacoesVeiculos`) e volta ao
-- comportamento anterior, sem erro.

-- Idempotente: usa a procedure AddColumnIfNotExists já existente no banco.
-- INT NULL para casar com `colaboradores.id` (mesmo tipo de
-- `movimentacoes_patrimonios.colaborador_id`). Sem FOREIGN KEY, seguindo o
-- padrão das demais colunas de vínculo do trilho legado — a tabela precisa
-- preservar o histórico mesmo que o colaborador seja excluído.
CALL AddColumnIfNotExists('movimentacoes_veiculos', 'motorista_origem_id',  'INT NULL');
CALL AddColumnIfNotExists('movimentacoes_veiculos', 'motorista_destino_id', 'INT NULL');

-- Sem backfill: as linhas antigas não têm como recuperar quem dirigia. Elas
-- permanecem com ambas as colunas NULL e continuam sendo lidas como
-- mobilização de obra, exatamente como hoje.
