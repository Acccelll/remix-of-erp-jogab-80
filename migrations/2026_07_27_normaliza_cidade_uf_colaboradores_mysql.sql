-- ============================================================
-- Migração: separa "Cidade/UF" em `colaboradores.cidade` e `colaboradores.uf`
-- Data: 2026-07-27
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: até 2026-07-27 o cadastro de colaborador gravava o resultado da
-- busca por CEP concatenado num campo só — `cidade` = "Rio Claro/SP" — porque
-- não existia coluna `uf`. Com a coluna criada em
-- 2026_07_26_logistica_georreferenciada_mysql, esta migração separa os
-- registros históricos, e o `EmployeeFormDialog` passou a gravar os dois
-- campos separados no mesmo commit.
--
-- Levantamento sobre o dump de produção: 81 registros têm "/" em `cidade` e em
-- TODOS o sufixo é uma UF válida (69 SP, o resto espalhado por 8 estados);
-- nenhum registro tinha `uf` preenchida. Depois de normalizar, 79 dos 81
-- geocodificam — os 2 que restam têm erro de digitação no nome do município
-- ('Chaqueada' por Charqueada e 'SANTA QUITERIA DO MARANHÃ' sem o "o" final)
-- e precisam de correção no cadastro, não de SQL.
--
-- Esta migração é OPCIONAL para o funcionamento da tela: o frontend tolera os
-- dois formatos desde o mesmo commit. Ela existe para deixar o dado limpo no
-- banco, o que importa para relatórios e filtros por UF.
--
-- Por que DOIS UPDATEs e não um só: num `UPDATE` único o MySQL avalia as
-- atribuições do `SET` da esquerda para a direita, e cada atribuição enxerga
-- os valores JÁ alterados pelas anteriores. Bastaria alguém reordenar as duas
-- colunas para `uf` passar a ser extraída de uma `cidade` já truncada — sem
-- erro nenhum, silenciosamente. Separar em dois passos elimina a armadilha.
--
-- Idempotente: na segunda execução o passo 1 não casa (`uf` já preenchida) e
-- o passo 2 também não (`cidade` já sem "/").

-- ── Passo 1: extrair a UF, com `cidade` ainda intacta ────────
-- A lista explícita de UFs impede que um valor mal digitado vire sigla — sem
-- ela, um 'Rua X/nº 2' gravaria uf = 'Nº'.
UPDATE `colaboradores`
   SET `uf` = UPPER(TRIM(SUBSTRING_INDEX(`cidade`, '/', -1)))
 WHERE (`uf` IS NULL OR `uf` = '')
   AND `cidade` LIKE '%/%'
   AND UPPER(TRIM(SUBSTRING_INDEX(`cidade`, '/', -1))) IN (
       'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
       'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
   );

-- ── Passo 2: só então remover o sufixo do nome da cidade ─────
-- A condição final garante que só é truncado o registro cujo sufixo é
-- exatamente a UF gravada no passo 1.
UPDATE `colaboradores`
   SET `cidade` = TRIM(SUBSTRING_INDEX(`cidade`, '/', 1))
 WHERE `uf` IS NOT NULL AND `uf` <> ''
   AND `cidade` LIKE '%/%'
   AND UPPER(TRIM(SUBSTRING_INDEX(`cidade`, '/', -1))) = `uf`;

-- ── Conferência (opcional, não altera dados) ─────────────────
-- Esperado depois de aplicar: nenhuma linha com "/" em `cidade`, e `uf`
-- preenchida para todos os que tinham o par combinado.
-- SELECT COUNT(*) AS ainda_com_barra FROM colaboradores WHERE cidade LIKE '%/%';
-- SELECT cidade, uf, COUNT(*) FROM colaboradores WHERE cidade <> '' GROUP BY cidade, uf ORDER BY 3 DESC;
