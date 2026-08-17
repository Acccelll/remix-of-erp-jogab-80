-- ============================================================
-- Migração: Histograma de recursos — delegações, tipos de veículo e valores
-- Data: 2026-07-19
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: página Histograma (matriz recursos × obras × semanas -1/atual/+1).
-- 1) delegacoes: subdivisões de funções para a visualização do histograma
--    (aba Delegações na página Funções); funcoes.delegacao_id vincula.
-- 2) veiculo_tipos: cadastro de tipos (aba Tipos na página Veículos) com
--    grupo "Veículos" | "Equipamentos"; seed com os tipos hoje fixos no
--    frontend (join por nome — veiculos.tipo continua string).
-- 3) histograma_valores: valores salvos por semana (segunda-feira) ×
--    coluna (obra ou especial) × recurso (função/tipo, por nome — lógica
--    simples desta primeira versão).
-- Compatível com MySQL antigo. Idempotente.

CREATE TABLE IF NOT EXISTS `delegacoes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL,
  `ordem` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_delegacoes_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL AddColumnIfNotExists('funcoes', 'delegacao_id', 'INT NULL');

CREATE TABLE IF NOT EXISTS `veiculo_tipos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL,
  `grupo` VARCHAR(20) NOT NULL DEFAULT 'Veículos',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_veiculo_tipos_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed: tipos hoje fixos no union TipoVeiculo do frontend. Máquinas
-- pesadas entram como Equipamentos; demais como Veículos.
INSERT IGNORE INTO `veiculo_tipos` (`nome`, `grupo`) VALUES
  ('Utilitário',       'Veículos'),
  ('De Passeio',       'Veículos'),
  ('Camionete',        'Veículos'),
  ('Ônibus',           'Veículos'),
  ('Retroescavadeira', 'Equipamentos'),
  ('Escavadeira',      'Equipamentos'),
  ('Munck',            'Equipamentos');

-- obra_key: id numérico da obra como texto, ou as colunas especiais
-- 'contratacao' e 'ocioso'. recurso_tipo: 'funcao' | 'veiculo_tipo'.
-- recurso_chave: nome da função ou do tipo (versão simples).
CREATE TABLE IF NOT EXISTS `histograma_valores` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `semana` DATE NOT NULL,
  `obra_key` VARCHAR(32) NOT NULL,
  `recurso_tipo` VARCHAR(16) NOT NULL,
  `recurso_chave` VARCHAR(120) NOT NULL,
  `valor` INT NOT NULL DEFAULT 0,
  `atualizado_em` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_histograma_celula` (`semana`, `obra_key`, `recurso_tipo`, `recurso_chave`),
  KEY `idx_histograma_semana` (`semana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
