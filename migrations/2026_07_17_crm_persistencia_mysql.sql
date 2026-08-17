-- ============================================================
-- Migração: persistência do CRM no MySQL (tarefas, perdas, histórico)
-- Data: 2026-07-17
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: tarefas de follow-up e motivos/registros de perda viviam
-- apenas em localStorage (por navegador); o histórico de oportunidades
-- era gravado best-effort numa tabela Supabase que nunca era lida.
-- Esta migração cria as tabelas MySQL para o api.php assumir a
-- persistência. IDs são UUIDs gerados no cliente (CHAR(36)) para
-- permitir upsert idempotente na reconciliação do legado localStorage.
-- Compatível com MySQL < 5.7 (sem tipo JSON; detalhes em LONGTEXT).
-- Idempotente: CREATE TABLE IF NOT EXISTS / INSERT IGNORE.

CREATE TABLE IF NOT EXISTS `crm_tarefas` (
  `id` CHAR(36) NOT NULL,
  `oportunidade_id` VARCHAR(64) NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `data` DATE NOT NULL,
  `responsavel_login` VARCHAR(100) DEFAULT NULL,
  `status` VARCHAR(12) NOT NULL DEFAULT 'aberta',
  `criada_em` DATETIME NOT NULL,
  `concluida_em` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_crm_tarefas_oportunidade` (`oportunidade_id`),
  KEY `idx_crm_tarefas_status_data` (`status`, `data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- id é o slug legível usado pelo frontend (ex.: 'preco', 'concorrente').
CREATE TABLE IF NOT EXISTS `crm_motivos_perda` (
  `id` VARCHAR(64) NOT NULL,
  `rotulo` VARCHAR(255) NOT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `criado_em` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Catálogo padrão (mesmos ids/rótulos do frontend MOTIVOS_PERDA_PADRAO).
INSERT IGNORE INTO `crm_motivos_perda` (`id`, `rotulo`, `ativo`) VALUES
  ('preco',       'Preço/condição comercial', 1),
  ('prazo',       'Prazo de execução',        1),
  ('concorrente', 'Concorrente vencedor',     1),
  ('escopo',      'Escopo fora do perfil',    1),
  ('sem_retorno', 'Cliente sem retorno',      1),
  ('cancelado',   'Projeto cancelado',        1);

-- Um registro de perda por oportunidade (novo registro substitui o anterior).
CREATE TABLE IF NOT EXISTS `crm_perdas` (
  `oportunidade_id` VARCHAR(64) NOT NULL,
  `motivo_id` VARCHAR(64) NOT NULL,
  `motivo_rotulo` VARCHAR(255) NOT NULL,
  `observacao` TEXT,
  `registrado_em` DATETIME NOT NULL,
  `registrado_por` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`oportunidade_id`),
  KEY `idx_crm_perdas_motivo` (`motivo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trilha de auditoria da oportunidade (movimentos de funil, edições,
-- comentários, criação). detalhes = JSON serializado.
CREATE TABLE IF NOT EXISTS `oportunidade_historico` (
  `id` CHAR(36) NOT NULL,
  `oportunidade_id` VARCHAR(64) NOT NULL,
  `tipo` VARCHAR(20) NOT NULL,
  `autor_id` VARCHAR(64) DEFAULT NULL,
  `autor_login` VARCHAR(100) DEFAULT NULL,
  `descricao` TEXT NOT NULL,
  `detalhes` LONGTEXT,
  `ocorrido_em` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_oport_hist_oportunidade` (`oportunidade_id`, `ocorrido_em`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
