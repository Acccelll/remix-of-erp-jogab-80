-- ============================================================
-- Migração: tratativa de ponto — dado cru, ocorrências e vínculo RHiD
-- Data: 2026-08-03
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: a Análise de Ponto lista exceções e não faz nada com elas.
-- Quatro lacunas estruturais, todas de armazenamento (ver
-- docs/PONTO_HUB_PROPOSTA.md):
--
--  1. O JSON diário devolvido pelo motor ACJEF da RHiD é lido, convertido em
--     ~15 colunas e jogado fora. Sem ele não há espelho de ponto ("por que o
--     dia 12 deu falta?") nem como re-mapear um campo novo sem refazer a
--     coleta contra a API (que é por pessoa, com janela de 90 dias).
--  2. Não existe chave estável entre a pessoa da RHiD e o colaborador do ERP:
--     o vínculo é refeito por CPF a cada importação e quem não casa vira
--     registro órfão silencioso (`colaborador_id = NULL`).
--  3. A exceção não tem estado. Quem tratou, o que decidiu e o que ficou
--     pendente vive fora do sistema.
--  4. Os erros por colaborador da sincronização RHiD aparecem no diálogo e
--     somem — colaborador que falha todo mês nunca vira alerta.
--
-- Decisão de modelagem (importante): `ponto_ocorrencias` NÃO tem FK para
-- `ponto_registros`. Sincronizar o mesmo período de novo apaga a importação
-- anterior (ON DELETE CASCADE em `ponto_registros`), e uma FK levaria junto a
-- tratativa já feita. A ocorrência é identificada pelo fato — pessoa + dia +
-- tipo — que sobrevive à recarga; `registro_id` fica como referência fraca,
-- reapontada a cada regeneração.
--
-- Reversão: tudo aditivo. `DROP TABLE` nas quatro tabelas novas e
-- `ALTER TABLE ponto_registros DROP COLUMN payload, DROP COLUMN rhid_id_person`
-- devolve o schema ao estado anterior; nenhuma coluna existente é alterada.
--
-- Idempotente: `CREATE TABLE IF NOT EXISTS` + a procedure
-- `AddColumnIfNotExists` já existente no banco.

-- ── 1. Dado cru e chave estável no registro diário ───────────

-- LONGTEXT (não JSON): mesma restrição das demais tabelas deste trilho —
-- compatível com MySQL < 5.7. O api.php serializa/desserializa em PHP.
-- Fica fora do SELECT de lista: só o espelho (por colaborador) carrega.
CALL AddColumnIfNotExists('ponto_registros', 'payload', 'LONGTEXT NULL');

-- idPerson da RHiD, quando a linha veio da apuração. Guardado na própria
-- linha para o espelho conseguir voltar à origem sem depender do cadastro.
CALL AddColumnIfNotExists('ponto_registros', 'rhid_id_person', 'INT NULL');

-- ── 2. Vínculo pessoa RHiD ↔ colaborador do ERP ──────────────

-- Confirmado na tela de Conciliação de Cadastro e reusado nas importações
-- seguintes, inclusive quando o CPF diverge entre os dois sistemas.
-- `ignorado = 1` marca quem não deve virar colaborador (terceiro, visitante),
-- para a divergência parar de reaparecer todo mês.
CREATE TABLE IF NOT EXISTS `rhid_pessoa_vinculo` (
  `id_person` INT NOT NULL,
  `colaborador_id` VARCHAR(64) DEFAULT NULL,
  `cpf` VARCHAR(14) DEFAULT NULL,
  `nome_rhid` VARCHAR(255) DEFAULT NULL,
  `ignorado` TINYINT(1) NOT NULL DEFAULT 0,
  `observacao` VARCHAR(255) DEFAULT NULL,
  `vinculado_em` DATETIME NOT NULL,
  `vinculado_por` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id_person`),
  KEY `idx_rhid_vinc_colab` (`colaborador_id`),
  KEY `idx_rhid_vinc_cpf` (`cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. Fila de tratativas ────────────────────────────────────

-- `chave_pessoa`: `colaborador_id` quando há vínculo, senão o nome lido da
-- origem — o mesmo critério de agrupamento de src/lib/ponto/analise.ts.
-- VARCHAR(100) + DATE + VARCHAR(30) cabem no limite de 767 bytes de índice
-- do InnoDB antigo (utf8mb4), por isso os tamanhos não são maiores.
-- A UNIQUE é o que torna a regeneração idempotente: reprocessar o período
-- atualiza a ocorrência existente em vez de duplicar, preservando o status.
CREATE TABLE IF NOT EXISTS `ponto_ocorrencias` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chave_pessoa` VARCHAR(100) NOT NULL,
  `data` DATE NOT NULL,
  `tipo` VARCHAR(30) NOT NULL,
  `registro_id` INT DEFAULT NULL,
  `colaborador_id` VARCHAR(64) DEFAULT NULL,
  `obra_id` VARCHAR(64) DEFAULT NULL,
  `nome` VARCHAR(255) NOT NULL DEFAULT '',
  `severidade` VARCHAR(10) NOT NULL DEFAULT 'media',
  `detalhe` VARCHAR(255) DEFAULT NULL,
  `minutos` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pendente',
  `responsavel` VARCHAR(100) DEFAULT NULL,
  `prazo` DATE DEFAULT NULL,
  `observacao` TEXT,
  `criado_em` DATETIME NOT NULL,
  `atualizado_em` DATETIME DEFAULT NULL,
  `atualizado_por` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ponto_ocor_fato` (`chave_pessoa`, `data`, `tipo`),
  KEY `idx_ponto_ocor_status_data` (`status`, `data`),
  KEY `idx_ponto_ocor_colab_data` (`colaborador_id`, `data`),
  KEY `idx_ponto_ocor_obra_data` (`obra_id`, `data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. De-para departamento → obra ───────────────────────────

-- Hoje a resolução é heurística implícita (`extrairCodigoNumerico` casa o
-- último grupo de 3-4 dígitos do nome do departamento com o código da obra) e
-- não há onde corrigir a exceção: departamento novo entra sem obra e ninguém
-- fica sabendo. Esta tabela é consultada primeiro; a heurística vira fallback.
CREATE TABLE IF NOT EXISTS `ponto_departamento_obra` (
  `departamento` VARCHAR(150) NOT NULL,
  `obra_id` VARCHAR(64) DEFAULT NULL,
  `indireto` TINYINT(1) NOT NULL DEFAULT 0,
  `atualizado_em` DATETIME NOT NULL,
  `atualizado_por` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`departamento`),
  KEY `idx_ponto_dep_obra` (`obra_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. Erros de sincronização ────────────────────────────────

-- Sem FK para `ponto_importacoes`: a importação é apagada quando o período é
-- re-sincronizado, e o histórico de falhas precisa sobreviver a isso — é ele
-- que mostra o colaborador que falha em toda apuração.
CREATE TABLE IF NOT EXISTS `ponto_sync_erros` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `importacao_id` INT DEFAULT NULL,
  `periodo_inicio` DATE NOT NULL,
  `periodo_fim` DATE NOT NULL,
  `id_person` INT NOT NULL,
  `nome_rhid` VARCHAR(255) DEFAULT NULL,
  `mensagem` TEXT,
  `ocorrido_em` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ponto_sync_erros_periodo` (`periodo_inicio`, `periodo_fim`),
  KEY `idx_ponto_sync_erros_person` (`id_person`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
