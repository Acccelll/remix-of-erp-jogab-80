-- ============================================================
-- Migração: justificativas e tipos de justificativa da RHiD
-- Data: 2026-08-04
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: a fila de tratativas criada em 2026_08_03_ponto_ondas.sql não sabe
-- o que já foi justificado. O DP resolve a falta na RHiD e, no ERP, a mesma
-- exceção continua pendente no mês seguinte — a fila nunca esvazia.
--
-- `POST /justifications` e `GET /justificationstype` fecham esse ciclo. Duas
-- decisões de modelagem:
--
--  1. **Cache, não consulta ao vivo.** Cruzar fila × justificativa roda a cada
--     abertura da aba Tratativas; bater na RHiD nesse caminho é inviável (cada
--     consulta faz login e respeita janela de 90 dias). As duas tabelas são
--     espelho do que a API devolveu, com `sincronizado_em` para saber a idade.
--  2. **Chave natural da RHiD.** `id_rhid` é o id do lado deles: re-sincronizar
--     o mesmo período atualiza a linha em vez de duplicar. Quando a API não
--     devolve id, o ERP monta um a partir de data+pessoa (ver
--     `normalizarJustificativas` em src/lib/ponto/justificativas.ts).
--
-- Os limites (`qtd_mensal` e afins) vêm do tipo e hoje ninguém confere: é o que
-- alimenta o painel de cotas estouradas.
--
-- Reversão: `DROP TABLE ponto_justificativas, ponto_justificativa_tipos`.
-- Nenhuma tabela existente é alterada.
-- Idempotente: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `ponto_justificativa_tipos` (
  `id` VARCHAR(40) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `abreviacao` VARCHAR(40) DEFAULT NULL,
  `abonar_dia_falta` TINYINT(1) NOT NULL DEFAULT 0,
  `desconta_dsr` TINYINT(1) NOT NULL DEFAULT 0,
  `exige_cid` TINYINT(1) NOT NULL DEFAULT 0,
  `qtd_mensal` INT DEFAULT NULL,
  `qtd_trimestral` INT DEFAULT NULL,
  `qtd_semestral` INT DEFAULT NULL,
  `qtd_anual` INT DEFAULT NULL,
  `sincronizado_em` DATETIME NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- `colaborador_id` fica desnormalizado (resolvido na gravação pelo vínculo/CPF)
-- para o cruzamento com `ponto_ocorrencias` não depender de join com o cadastro.
CREATE TABLE IF NOT EXISTS `ponto_justificativas` (
  `id_rhid` VARCHAR(80) NOT NULL,
  `id_person` INT DEFAULT NULL,
  `colaborador_id` VARCHAR(64) DEFAULT NULL,
  `nome_rhid` VARCHAR(255) DEFAULT NULL,
  `cpf` VARCHAR(14) DEFAULT NULL,
  `data_inicio` DATE NOT NULL,
  `data_fim` DATE NOT NULL,
  `id_tipo` VARCHAR(40) DEFAULT NULL,
  `tipo_nome` VARCHAR(255) DEFAULT NULL,
  `status_aprovacao` VARCHAR(20) NOT NULL DEFAULT 'desconhecido',
  `motivo` TEXT,
  `sincronizado_em` DATETIME NOT NULL,
  PRIMARY KEY (`id_rhid`),
  KEY `idx_ponto_just_periodo` (`data_inicio`, `data_fim`),
  KEY `idx_ponto_just_pessoa` (`id_person`),
  KEY `idx_ponto_just_colab` (`colaborador_id`),
  KEY `idx_ponto_just_status` (`status_aprovacao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
