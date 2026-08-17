-- ============================================================
-- Migração: histórico de contrato como evento tipado
-- Data: 2026-08-01
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: contrato é o inverso de colaborador e patrimônio.
--
-- Naqueles dois não existia coluna `historico`, o api.php descartava o campo e
-- o histórico era reconstruído na leitura — os eventos se perdiam. Aqui a
-- coluna `contratos.historico` EXISTE, é gravada e tem dado bom: 32 contratos
-- somam 57 eventos com autoria real, tipo e descrição. E nada disso aparece na
-- tela, porque `$loadHistoricoContrato` lê de `movimentacoes_contratos` e o GET
-- sobrescreve o valor da coluna com esse resultado. A coluna é escrita e nunca
-- lida.
--
-- O que sobrescreve é pior do que o que foi ignorado: as 31 linhas de
-- `movimentacoes_contratos` têm `obra_destino_id` E `data_programada` nulos —
-- todas. A descrição gerada sai como "Mobilizado de Sem Alocação para Sem
-- Alocação", sem data e sem aspas, e o regex do front exige aspas e " em
-- dd/mm/yyyy", de modo que nunca casa: todo período de contrato é rotulado
-- "Sem Alocação". O custo por obra do contrato é calculado sobre isso.
--
-- Esta migração importa o JSON para `movimentacoes_contratos` como evento
-- tipado, recuperando obra de destino, data efetiva e autoria.
--
-- Reversão: colunas aditivas e NULL (exceto `tipo`, com DEFAULT). Remover as
-- colunas e apagar as linhas com `observacao LIKE 'importado:%'` desfaz tudo;
-- `contratos.historico` não é tocada e continua sendo a fonte original.

-- ── 1. Colunas ───────────────────────────────────────────────
-- Aspas simples internas escapadas (dobradas): a procedure concatena o texto
-- direto num ALTER dinâmico, e aspas duplas quebrariam sob `ANSI_QUOTES`.
CALL AddColumnIfNotExists('movimentacoes_contratos', 'tipo',
  'ENUM(''mobilizacao'',''status'',''status_contrato'',''cadastro'',''outro'') NOT NULL DEFAULT ''mobilizacao''');
CALL AddColumnIfNotExists('movimentacoes_contratos', 'status_origem',  'VARCHAR(30) NULL');
CALL AddColumnIfNotExists('movimentacoes_contratos', 'status_destino', 'VARCHAR(30) NULL');
CALL AddColumnIfNotExists('movimentacoes_contratos', 'observacao',     'TEXT NULL');
CALL AddColumnIfNotExists('movimentacoes_contratos', 'registrado_em',  'DATETIME NULL');

-- Vocabulário de `status_*`:
--   alocação        → ocioso | sem_alocacao | indeterminado
--   status_contrato → rascunho | ativo | suspenso | encerrado | inadimplente

-- ── 2. Eixo temporal das linhas já existentes ────────────────
-- `data_programada` passa a ser a data EFETIVA e `registrado_em` o instante do
-- lançamento. Nas 31 linhas antigas a data efetiva nunca foi gravada; herdam a
-- do lançamento, que é a melhor aproximação disponível.
UPDATE movimentacoes_contratos
   SET data_programada = DATE(data_movimentacao)
 WHERE data_programada IS NULL;

UPDATE movimentacoes_contratos
   SET registrado_em = data_movimentacao
 WHERE registrado_em IS NULL;

-- ── 3. Tipagem das linhas já existentes ──────────────────────
UPDATE movimentacoes_contratos
   SET tipo = 'mobilizacao'
 WHERE obra_destino_id IS NOT NULL;

-- As linhas sem destino não dizem para onde o contrato foi. Diferente de
-- patrimônio e colaborador, aqui não há flag nem coluna de estado que permita
-- inferir: `ocioso` reflete só a situação de hoje, não a de cada movimento.
-- Ficam explicitamente indeterminadas — é justamente por isso que a importação
-- do JSON, abaixo, existe.
UPDATE movimentacoes_contratos
   SET tipo = 'status', status_destino = 'indeterminado'
 WHERE obra_destino_id IS NULL
   AND status_destino IS NULL
   AND tipo <> 'cadastro';

-- ── 4. Importação do histórico JSON ──────────────────────────
-- O núcleo desta migração. `JSON_TABLE` (MySQL 8) explode `contratos.historico`
-- e cada evento vira uma linha tipada.
--
-- Resolução de obra pela REGRA DE PREFIXO: o histórico guarda o nome da época
-- ("214 - Barra Bonita") e a obra hoje se chama só "214". Sem cortar no " - ",
-- metade das referências se perderia. Conferido contra o dump de 30/07: 62 de
-- 62 referências resolvem. `MIN(o.id)` desempata os nomes duplicados que
-- existem no banco (duas obras chamadas "220").
--
-- `observacao` marca a procedência com 'importado:<uuid do evento>', o que dá
-- a chave de idempotência e permite desfazer a importação sem tocar no resto.

INSERT INTO movimentacoes_contratos
       (contrato_id, obra_origem_id, obra_destino_id, data_movimentacao,
        data_programada, usuario_id, tipo, status_origem, status_destino,
        observacao, registrado_em)
SELECT
    src.contrato_id,
    src.obra_origem_id,
    src.obra_destino_id,
    src.registrado_em,
    COALESCE(src.data_efetiva, DATE(src.registrado_em)),
    src.usuario_id,
    -- Invariante mantida igual à das outras duas tabelas: `mobilizacao` só
    -- quando há obra de destino de fato. Sem ela o evento é de status.
    CASE
      WHEN src.ev_tipo = 'cadastro'          THEN 'cadastro'
      WHEN src.obra_destino_id IS NOT NULL   THEN 'mobilizacao'
      ELSE 'status'
    END,
    NULL,
    CASE
      WHEN src.ev_tipo = 'cadastro'        THEN NULL
      WHEN src.obra_destino_id IS NOT NULL THEN NULL
      -- Mobilização sem aspas e sem data é o texto DERIVADO que o front leu de
      -- volta e regravou no JSON: não carrega destino algum.
      WHEN src.destino_nome IS NULL                          THEN 'indeterminado'
      WHEN src.destino_nome IN ('Sem Alocação', 'Sem Alocacao') THEN 'sem_alocacao'
      WHEN src.destino_nome = 'Ocioso'                       THEN 'ocioso'
      ELSE 'indeterminado'
    END,
    CONCAT('importado:', src.ev_id),
    src.registrado_em
FROM (
    SELECT
        c.id AS contrato_id,
        j.ev_id,
        j.ev_tipo,
        -- `data` do evento vem em ISO com milissegundos ("2026-04-29T15:30:25.544Z").
        -- `data_movimentacao` é NOT NULL, daí o COALESCE de segurança.
        COALESCE(
          STR_TO_DATE(NULLIF(j.ev_data, ''), '%Y-%m-%dT%H:%i:%s.%fZ'),
          NOW()
        ) AS registrado_em,
        u.id AS usuario_id,
        -- Nome entre aspas depois de 'de "' e de 'para "'. Quando a descrição
        -- não tem aspas, os SUBSTRING_INDEX devolvem a string inteira, que não
        -- casa com obra nenhuma — e o NULLIF abaixo a transforma em NULL.
        NULLIF(
          CASE WHEN j.ev_desc LIKE '%de "%'
               THEN SUBSTRING_INDEX(SUBSTRING_INDEX(j.ev_desc, 'de "', -1), '"', 1) END, ''
        ) AS origem_nome,
        NULLIF(
          CASE WHEN j.ev_desc LIKE '%para "%'
               THEN SUBSTRING_INDEX(SUBSTRING_INDEX(j.ev_desc, 'para "', -1), '"', 1) END, ''
        ) AS destino_nome,
        STR_TO_DATE(
          NULLIF(REGEXP_SUBSTR(j.ev_desc, '[0-9]{2}/[0-9]{2}/[0-9]{4}'), ''), '%d/%m/%Y'
        ) AS data_efetiva,
        (SELECT MIN(o.id) FROM obras o
          WHERE o.nome = NULLIF(CASE WHEN j.ev_desc LIKE '%de "%'
                THEN SUBSTRING_INDEX(SUBSTRING_INDEX(j.ev_desc, 'de "', -1), '"', 1) END, '')
             OR o.nome = SUBSTRING_INDEX(
                  NULLIF(CASE WHEN j.ev_desc LIKE '%de "%'
                    THEN SUBSTRING_INDEX(SUBSTRING_INDEX(j.ev_desc, 'de "', -1), '"', 1) END, ''),
                  ' - ', 1)
        ) AS obra_origem_id,
        (SELECT MIN(o.id) FROM obras o
          WHERE o.nome = NULLIF(CASE WHEN j.ev_desc LIKE '%para "%'
                THEN SUBSTRING_INDEX(SUBSTRING_INDEX(j.ev_desc, 'para "', -1), '"', 1) END, '')
             OR o.nome = SUBSTRING_INDEX(
                  NULLIF(CASE WHEN j.ev_desc LIKE '%para "%'
                    THEN SUBSTRING_INDEX(SUBSTRING_INDEX(j.ev_desc, 'para "', -1), '"', 1) END, ''),
                  ' - ', 1)
        ) AS obra_destino_id
    FROM contratos c
    JOIN JSON_TABLE(
        c.historico, '$[*]' COLUMNS (
            ev_id   VARCHAR(64)  PATH '$.id',
            ev_data VARCHAR(40)  PATH '$.data',
            ev_tipo VARCHAR(30)  PATH '$.tipo',
            ev_user VARCHAR(120) PATH '$.usuario',
            ev_desc TEXT         PATH '$.descricao'
        )
    ) j
    LEFT JOIN usuarios u ON u.login = j.ev_user
    WHERE c.historico IS NOT NULL
) src
WHERE NOT EXISTS (
    SELECT 1 FROM movimentacoes_contratos m
     WHERE m.contrato_id = src.contrato_id
       AND m.observacao  = CONCAT('importado:', src.ev_id)
);

-- ── 5. Índice de leitura ─────────────────────────────────────
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE table_schema = DATABASE()
               AND table_name   = 'movimentacoes_contratos'
               AND index_name   = 'idx_mov_contrato_data');
SET @sql := IF(@idx = 0,
               'ALTER TABLE movimentacoes_contratos ADD INDEX idx_mov_contrato_data (contrato_id, data_programada, id)',
               'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 6. `contratos.historico` NÃO é apagada ───────────────────
-- É a única cópia do que acabou de ser importado. Enquanto a importação não
-- for conferida em produção, dropar a coluna seria irreversível. Ela passa a
-- ser legado somente-leitura: o api.php deixa de escrever nela e deixa de
-- sobrescrevê-la na leitura.

-- ── 7. Conferência pós-aplicação ─────────────────────────────
--   -- Distribuição esperada: 26 mobilizações com obra + 26 cadastros +
--   -- 5 indeterminados importados + 31 linhas antigas indeterminadas.
--   SELECT tipo, status_destino, COUNT(*)
--     FROM movimentacoes_contratos GROUP BY tipo, status_destino;
--
--   -- Eventos importados (esperado 57):
--   SELECT COUNT(*) FROM movimentacoes_contratos WHERE observacao LIKE 'importado:%';
--
--   -- Autoria recuperada — esperado 0 importados sem usuário:
--   SELECT COUNT(*) FROM movimentacoes_contratos
--    WHERE observacao LIKE 'importado:%' AND usuario_id IS NULL;
--
--   -- Nenhuma linha sem eixo temporal (esperado 0):
--   SELECT COUNT(*) FROM movimentacoes_contratos
--    WHERE data_programada IS NULL OR registrado_em IS NULL;
--
--   -- Mobilizações que resolveram obra de destino (esperado 26):
--   SELECT COUNT(*) FROM movimentacoes_contratos
--    WHERE observacao LIKE 'importado:%' AND obra_destino_id IS NOT NULL;
