-- ============================================================
-- Migração: histórico de patrimônio como evento tipado
-- Data: 2026-07-31
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: mesma doença já corrigida em `movimentacoes`
-- (2026_07_30_colaborador_eventos_tipados_mysql), agora em
-- `movimentacoes_patrimonios`. `patrimonios` não tem coluna `historico` — o
-- api.php descarta o campo no PUT e reconstrói o histórico a cada leitura a
-- partir desta tabela, que só guarda obra de origem/destino. Toda ida para
-- "Em Manutenção" ou "Sujo" vira `obra_destino_id = NULL`, indistinguível de
-- uma desmobilização, e o front reinterpreta a prosa gerada com regex.
--
-- Diferença em relação a colaborador: o status do patrimônio não vive numa
-- coluna exclusiva (`status_especial`) e sim em flags booleanas independentes
-- (`em_manutencao`, `sujo`), que em tese coexistem com uma obra. Na prática o
-- quadro as trata como colunas exclusivas — mobilizar para `__manutencao__`
-- zera `obra_atual_id`. O backfill abaixo respeita essa ambiguidade em vez de
-- fingir que ela não existe.
--
-- Reversão: colunas aditivas e NULL (exceto `tipo`, com DEFAULT). Basta
-- removê-las e o índice; o api.php detecta a ausência via SHOW COLUMNS e volta
-- ao comportamento anterior.

-- ── 1. Colunas ───────────────────────────────────────────────
-- Aspas simples internas escapadas (dobradas): a procedure concatena o texto
-- direto num ALTER dinâmico, e aspas duplas quebrariam sob `ANSI_QUOTES`.
CALL AddColumnIfNotExists('movimentacoes_patrimonios', 'tipo',
  'ENUM(''mobilizacao'',''status'',''responsavel'',''inativacao'',''reativacao'',''outro'') NOT NULL DEFAULT ''mobilizacao''');
CALL AddColumnIfNotExists('movimentacoes_patrimonios', 'status_origem',  'VARCHAR(30) NULL');
CALL AddColumnIfNotExists('movimentacoes_patrimonios', 'status_destino', 'VARCHAR(30) NULL');
CALL AddColumnIfNotExists('movimentacoes_patrimonios', 'colaborador_id', 'INT NULL');
CALL AddColumnIfNotExists('movimentacoes_patrimonios', 'observacao',     'TEXT NULL');
CALL AddColumnIfNotExists('movimentacoes_patrimonios', 'registrado_em',  'DATETIME NULL');

-- Vocabulário de `status_*`: manutencao | sujo | sem_alocacao | indeterminado.
-- `colaborador_id` registra a quem o patrimônio passou quando `tipo` =
-- 'responsavel' — hoje essa transferência só existe em
-- `responsabilidades_patrimonios`, sem aparecer no histórico do bem.

-- ── 2. Eixo temporal único ───────────────────────────────────
-- `data_programada` passa a ser a data EFETIVA do evento e `registrado_em` o
-- instante do lançamento. 42 das 122 linhas em produção não têm
-- `data_programada`; herdam a data do lançamento, que é a melhor aproximação
-- disponível. Note que aqui `data_movimentacao` é DATETIME (em
-- `movimentacoes`, de colaborador, é DATE) — daí o DATE() explícito.
UPDATE movimentacoes_patrimonios
   SET data_programada = DATE(data_movimentacao)
 WHERE data_programada IS NULL;

UPDATE movimentacoes_patrimonios
   SET registrado_em = data_movimentacao
 WHERE registrado_em IS NULL;

-- ── 3. Backfill: mobilizações de fato ────────────────────────
UPDATE movimentacoes_patrimonios
   SET tipo = 'mobilizacao'
 WHERE obra_destino_id IS NOT NULL;

-- ── 4. Backfill conservador dos destinos NULL ────────────────
-- 4a. Última movimentação de um patrimônio que HOJE está com exatamente uma
--     flag de status ligada: a flag prova qual foi o destino daquele evento.
--     Com as duas flags ligadas não há como saber qual delas motivou o
--     movimento, então cai no 4b.
UPDATE movimentacoes_patrimonios m
  JOIN (
        SELECT patrimonio_id, MAX(id) AS ultimo_id
          FROM movimentacoes_patrimonios
         GROUP BY patrimonio_id
       ) u ON u.ultimo_id = m.id
  JOIN patrimonios p ON p.id = m.patrimonio_id
   SET m.tipo           = 'status',
       m.status_destino = CASE
                            WHEN p.em_manutencao = 1 AND p.sujo = 0 THEN 'manutencao'
                            WHEN p.sujo = 1 AND p.em_manutencao = 0 THEN 'sujo'
                          END
 WHERE m.obra_destino_id IS NULL
   AND m.tipo <> 'responsavel'
   AND (p.em_manutencao = 1 XOR p.sujo = 1);

-- 4b. Demais destinos NULL: ambíguos. Marcados como tal em vez de receberem um
--     status inventado — a UI exibe "Saiu da obra".
--
--     A guarda por `tipo` é o que mantém a migração reexecutável: os eventos de
--     responsabilidade criados na seção 5 também têm destino nulo, e sem ela
--     uma segunda execução os converteria em 'status'/'indeterminado',
--     apagando de quem era o bem.
UPDATE movimentacoes_patrimonios
   SET tipo           = 'status',
       status_destino = 'indeterminado'
 WHERE obra_destino_id IS NULL
   AND status_destino IS NULL
   AND tipo <> 'responsavel';

-- 4c. `status_origem` derivado do destino do evento anterior do mesmo bem.
UPDATE movimentacoes_patrimonios m
  JOIN (
        SELECT id,
               LAG(status_destino) OVER (
                 PARTITION BY patrimonio_id ORDER BY data_programada, id
               ) AS anterior
          FROM movimentacoes_patrimonios
       ) prev ON prev.id = m.id
   SET m.status_origem = prev.anterior
 WHERE m.status_origem IS NULL
   AND prev.anterior IS NOT NULL
   AND prev.anterior <> 'indeterminado';

-- ── 5. Responsabilidade vira evento do histórico do bem ──────
-- `responsabilidades_patrimonios` já guarda os períodos, mas a troca de
-- responsável nunca apareceu no histórico do patrimônio. Importa cada período
-- como um evento, sem apagar a tabela de origem (que continua sendo a fonte
-- dos períodos abertos).
INSERT INTO movimentacoes_patrimonios
       (patrimonio_id, obra_origem_id, obra_destino_id, data_movimentacao,
        data_programada, usuario_id, tipo, colaborador_id, registrado_em)
SELECT r.patrimonio_id, NULL, NULL, COALESCE(r.created_at, r.data_inicio),
       r.data_inicio, NULL, 'responsavel', r.colaborador_id,
       COALESCE(r.created_at, r.data_inicio)
  FROM responsabilidades_patrimonios r
 WHERE NOT EXISTS (
        SELECT 1 FROM movimentacoes_patrimonios m
         WHERE m.patrimonio_id  = r.patrimonio_id
           AND m.tipo           = 'responsavel'
           AND m.colaborador_id = r.colaborador_id
           AND m.data_programada = r.data_inicio
       );

-- ── 6. Índice de leitura ─────────────────────────────────────
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE table_schema = DATABASE()
               AND table_name   = 'movimentacoes_patrimonios'
               AND index_name   = 'idx_mov_pat_data');
SET @sql := IF(@idx = 0,
               'ALTER TABLE movimentacoes_patrimonios ADD INDEX idx_mov_pat_data (patrimonio_id, data_programada, id)',
               'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 7. Conferência pós-aplicação ─────────────────────────────
--   -- Esperado 0:
--   SELECT COUNT(*) FROM movimentacoes_patrimonios
--    WHERE data_programada IS NULL OR registrado_em IS NULL;
--
--   -- Coerência de tipo (todas devem dar 0):
--   SELECT COUNT(*) FROM movimentacoes_patrimonios WHERE tipo='mobilizacao' AND obra_destino_id IS NULL;
--   SELECT COUNT(*) FROM movimentacoes_patrimonios WHERE tipo='status' AND obra_destino_id IS NOT NULL;
--   SELECT COUNT(*) FROM movimentacoes_patrimonios WHERE tipo='responsavel' AND colaborador_id IS NULL;
--
--   -- Períodos de responsabilidade importados:
--   SELECT (SELECT COUNT(*) FROM responsabilidades_patrimonios) AS periodos,
--          (SELECT COUNT(*) FROM movimentacoes_patrimonios WHERE tipo='responsavel') AS eventos;
