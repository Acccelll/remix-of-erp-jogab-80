-- ============================================================
-- Migração: dispositivos REP e arquivamento do AFD
-- Data: 2026-08-04
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: duas lacunas de conformidade do ponto eletrônico.
--
--  1. **Relógio mudo não é visível.** A Visão Geral conta marcação inválida por
--     obra, mas não sabe dizer que o REP daquela obra não comunica há três
--     dias — que costuma ser a causa. `GET /device` entrega
--     `lastConnectionDate`/`lastSyncDate` e o ERP descartava.
--  2. **AFD depende do portal da ControlID.** É o arquivo que a fiscalização
--     exige (Portarias 1510 e 671/MTE). Sem arquivamento local, gerar um AFD de
--     período antigo é impossível: a API só serve janelas de 90 dias.
--
-- Onde fica o arquivo: bucket **privado** `ponto-afd` do Supabase Storage
-- (policies em supabase/migrations, restritas a GM — o AFD carrega PIS e CPF de
-- toda a base). Aqui ficam só os metadados que provam o que foi gerado:
-- equipamento, período, faixa de NSR, contagem de linhas e o sha256 do
-- conteúdo. Divergência de hash depois indica arquivo adulterado.
--
-- `ponto_dispositivos` é snapshot, não histórico: a pergunta é "está mudo
-- agora?". Re-sincronizar sobrescreve a linha do equipamento.
--
-- Reversão: `DROP TABLE ponto_afd_arquivos, ponto_dispositivos`.
-- Idempotente: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `ponto_dispositivos` (
  `id_device` INT NOT NULL,
  `nome` VARCHAR(255) DEFAULT NULL,
  `serial` VARCHAR(80) DEFAULT NULL,
  `versao` VARCHAR(40) DEFAULT NULL,
  `status` VARCHAR(40) DEFAULT NULL,
  `status_papel` VARCHAR(40) DEFAULT NULL,
  `id_empresa` VARCHAR(64) DEFAULT NULL,
  `num_pessoas` INT DEFAULT NULL,
  `num_digitais` INT DEFAULT NULL,
  `ultima_conexao` DATETIME DEFAULT NULL,
  `ultima_sincronizacao` DATETIME DEFAULT NULL,
  `sincronizado_em` DATETIME NOT NULL,
  PRIMARY KEY (`id_device`),
  KEY `idx_ponto_disp_conexao` (`ultima_conexao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ponto_afd_arquivos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `id_device` INT NOT NULL,
  `equipamento_nome` VARCHAR(255) DEFAULT NULL,
  `layout` VARCHAR(10) NOT NULL,
  `coletor` TINYINT(1) NOT NULL DEFAULT 0,
  `periodo_inicio` DATE DEFAULT NULL,
  `periodo_fim` DATE DEFAULT NULL,
  `nsr_inicial` INT DEFAULT NULL,
  `nsr_final` INT DEFAULT NULL,
  `linhas` INT NOT NULL DEFAULT 0,
  `sha256` CHAR(64) NOT NULL,
  `storage_path` VARCHAR(255) DEFAULT NULL,
  `truncado` TINYINT(1) NOT NULL DEFAULT 0,
  `gerado_por` VARCHAR(100) DEFAULT NULL,
  `gerado_em` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ponto_afd_device_periodo` (`id_device`, `periodo_inicio`, `periodo_fim`),
  KEY `idx_ponto_afd_gerado_em` (`gerado_em`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
