-- ============================================================
-- Migração: histórico de colaborador como evento tipado
-- Data: 2026-07-30
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: `colaboradores` não tem coluna `historico` — o api.php descarta o
-- campo no INSERT/UPDATE e reconstrói o histórico a cada leitura a partir de
-- `movimentacoes`. Como `movimentacoes` só guarda obra de origem/destino, toda
-- ida para férias, folga ou afastamento é gravada como `obra_destino_id = NULL`,
-- indistinguível de uma desmobilização. O front então lê a prosa gerada
-- ("Mobilizado de X para Sem Alocação em dd/mm/yyyy") e a interpreta de volta
-- com regex, exibindo férias como se fosse período de obra.
--
-- Esta migração transforma `movimentacoes` num log de eventos tipado. A tabela
-- tem hoje um único produtor (rota `mobilizar`) e um único consumidor
-- (`$loadHistorico`), ambos no api.php — nada mais no backend e nada no
-- frontend a lê —, então a evolução é feita em lugar, sem tabela paralela.
--
-- Reversão: as colunas são todas aditivas e NULL (exceto `tipo`, com DEFAULT).
-- Para reverter, basta remover as colunas e o índice; o api.php detecta a
-- ausência delas via SHOW COLUMNS e volta ao comportamento anterior.

-- ── 1. Colunas ───────────────────────────────────────────────
-- Idempotente: usa a procedure AddColumnIfNotExists já existente no banco
-- (mesmo padrão de 2026_07_26_logistica_georreferenciada_mysql.sql).
--
-- `status_*` é VARCHAR e não ENUM de propósito: além dos três valores de
-- `colaboradores.status_especial` (folga/afastamento/ferias) o log precisa
-- registrar 'sem_alocacao' (saída de obra sem status) e 'indeterminado'
-- (backfill do histórico ambíguo, ver seção 4). Sem CHECK para não travar a
-- evolução do vocabulário — a validação fica no api.php.
-- As aspas simples internas vão escapadas (dobradas) em vez de a definição vir
-- entre aspas duplas: a procedure concatena o texto direto no ALTER dinâmico, e
-- aspas duplas quebrariam num banco com `ANSI_QUOTES` no sql_mode.
CALL AddColumnIfNotExists('movimentacoes', 'tipo',
  'ENUM(''mobilizacao'',''status'',''inativacao'',''reativacao'',''outro'') NOT NULL DEFAULT ''mobilizacao''');
CALL AddColumnIfNotExists('movimentacoes', 'status_origem',  'VARCHAR(30) NULL');
CALL AddColumnIfNotExists('movimentacoes', 'status_destino', 'VARCHAR(30) NULL');
CALL AddColumnIfNotExists('movimentacoes', 'observacao',     'TEXT NULL');
CALL AddColumnIfNotExists('movimentacoes', 'registrado_em',  'DATETIME NULL');

-- ── 2. Eixo temporal único ───────────────────────────────────
-- `data_programada` passa a ser a DATA EFETIVA canônica do evento (quando ele
-- vale) e `registrado_em`, o instante do lançamento. Antes disso os dois papéis
-- estavam misturados: mobilizações eram ordenadas pela data extraída da prosa
-- (= data_programada) e os demais eventos por `data_movimentacao`, de modo que
-- a mesma lista era ordenada por dois eixos diferentes.
UPDATE movimentacoes
   SET data_programada = data_movimentacao
 WHERE data_programada IS NULL;

UPDATE movimentacoes
   SET registrado_em = TIMESTAMP(data_movimentacao)
 WHERE registrado_em IS NULL;

-- ── 3. Backfill: eventos que são mobilização de fato ─────────
UPDATE movimentacoes
   SET tipo = 'mobilizacao'
 WHERE obra_destino_id IS NOT NULL;

-- ── 4. Backfill conservador dos destinos NULL ────────────────
-- 84 das 362 linhas em produção têm `obra_destino_id = NULL` e não dizem se
-- foram férias, folga, afastamento ou desmobilização — a informação nunca foi
-- gravada. O backfill só afirma o que dá para provar.
--
-- 4a. Última movimentação de quem HOJE está em status especial: o status atual
--     do colaborador é a prova de qual foi o destino daquele evento.
UPDATE movimentacoes m
  JOIN (
        SELECT colaborador_id, MAX(id) AS ultimo_id
          FROM movimentacoes
         GROUP BY colaborador_id
       ) u ON u.ultimo_id = m.id
  JOIN colaboradores c ON c.id = m.colaborador_id
   SET m.tipo           = 'status',
       m.status_destino = c.status_especial
 WHERE m.obra_destino_id IS NULL
   AND c.status_especial IS NOT NULL;

-- 4b. Demais destinos NULL: ambíguos. Marcados como tal em vez de receberem um
--     status inventado — a UI exibe "Saiu da obra", que é tudo o que se sabe.
UPDATE movimentacoes
   SET tipo           = 'status',
       status_destino = 'indeterminado'
 WHERE obra_destino_id IS NULL
   AND status_destino IS NULL;

-- 4c. `status_origem` derivado do destino do evento anterior do mesmo
--     colaborador. Sem isso, sair de férias para uma obra registra origem
--     "Sem Alocação" e a informação de que ele estava de férias se perde.
UPDATE movimentacoes m
  JOIN (
        SELECT id,
               LAG(status_destino) OVER (
                 PARTITION BY colaborador_id ORDER BY data_programada, id
               ) AS anterior
          FROM movimentacoes
       ) prev ON prev.id = m.id
   SET m.status_origem = prev.anterior
 WHERE m.status_origem IS NULL
   AND prev.anterior IS NOT NULL
   AND prev.anterior <> 'indeterminado';

-- ── 5. Índice de leitura ─────────────────────────────────────
-- Cobre a rota `mobilizacoesPeriodos` (janela LEAD particionada por
-- colaborador e ordenada por data efetiva, com desempate por id) e o
-- $loadHistorico. Não existe procedure AddIndexIfNotExists no banco; a guarda
-- é feita com information_schema + SQL dinâmico, como em
-- 2026_07_26_logistica_georreferenciada_mysql.sql.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE table_schema = DATABASE()
               AND table_name   = 'movimentacoes'
               AND index_name   = 'idx_movimentacoes_colab_data');
SET @sql := IF(@idx = 0,
               'ALTER TABLE movimentacoes ADD INDEX idx_movimentacoes_colab_data (colaborador_id, data_programada, id)',
               'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 6. Duplicatas: diagnóstico, não remoção ──────────────────
-- A rota `mobilizar` não tinha guarda de idempotência, então há eventos
-- idênticos gravados mais de uma vez (em produção: colaborador 167 ids
-- 552/554, colaborador 54 ids 527/538/539). Cada duplicata vira um período
-- fantasma de 0 dias na aba Histórico.
--
-- A proteção contra NOVAS duplicatas passa a ser feita no api.php. As linhas
-- já existentes NÃO são apagadas aqui: apagar histórico é irreversível e a
-- decisão é do operador. Rode a consulta abaixo, revise, e só então decida.
--
--   SELECT colaborador_id, data_programada, tipo,
--          COALESCE(obra_destino_id, -1) AS destino,
--          COALESCE(status_destino, '-') AS status,
--          COUNT(*) AS repeticoes,
--          GROUP_CONCAT(id ORDER BY id) AS ids
--     FROM movimentacoes
--    GROUP BY colaborador_id, data_programada, tipo, destino, status
--   HAVING COUNT(*) > 1
--    ORDER BY colaborador_id, data_programada;
--
-- Depois de revisar (e com backup feito), a remoção mantendo o menor id seria:
--
--   DELETE m FROM movimentacoes m
--     JOIN (SELECT MIN(id) AS manter, colaborador_id, data_programada, tipo,
--                  COALESCE(obra_destino_id, -1) AS destino,
--                  COALESCE(status_destino, '-') AS status
--             FROM movimentacoes
--            GROUP BY colaborador_id, data_programada, tipo, destino, status
--           HAVING COUNT(*) > 1) d
--       ON  d.colaborador_id  = m.colaborador_id
--       AND d.data_programada = m.data_programada
--       AND d.tipo            = m.tipo
--       AND d.destino         = COALESCE(m.obra_destino_id, -1)
--       AND d.status          = COALESCE(m.status_destino, '-')
--    WHERE m.id > d.manter;
--
-- Só depois disso faz sentido criar o índice único que impede a reincidência.

-- ── 7. Conferência pós-aplicação ─────────────────────────────
--   -- Nenhuma linha deve restar sem eixo temporal:
--   SELECT COUNT(*) FROM movimentacoes WHERE data_programada IS NULL OR registrado_em IS NULL;
--
--   -- Os colaboradores hoje em status especial devem ter a última
--   -- movimentação tipada como 'status' com o status correspondente:
--   SELECT c.id, c.nome, c.status_especial, m.tipo, m.status_destino, m.data_programada
--     FROM colaboradores c
--     JOIN movimentacoes m ON m.id = (SELECT MAX(id) FROM movimentacoes WHERE colaborador_id = c.id)
--    WHERE c.status_especial IS NOT NULL;
