-- ============================================================
-- CRM — Fundação (Fase 1)
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
-- Cria as tabelas do módulo CRM e ajusta clientes/usuarios.
-- Idempotente onde possível (IF NOT EXISTS / verificar antes de ALTER).
-- ============================================================

-- Estágios do funil — versionáveis em tabela (em vez de ENUM fixo).
CREATE TABLE IF NOT EXISTS funil_estagios (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  chave  VARCHAR(30)  NOT NULL UNIQUE,
  rotulo VARCHAR(80)  NOT NULL,
  ordem  INT          NOT NULL DEFAULT 0,
  ativo  TINYINT(1)   NOT NULL DEFAULT 1
);

INSERT INTO funil_estagios (chave, rotulo, ordem, ativo) VALUES
  ('prospeccao',      'Prospecção',      1, 1),
  ('qualificacao',    'Qualificação',    2, 1),
  ('proposta',        'Proposta',        3, 1),
  ('negociacao',      'Negociação',      4, 1),
  ('fechado_ganho',   'Fechado Ganho',   5, 1),
  ('fechado_perdido', 'Fechado Perdido', 6, 1)
ON DUPLICATE KEY UPDATE rotulo = VALUES(rotulo), ordem = VALUES(ordem);

-- Leads.
CREATE TABLE IF NOT EXISTS leads (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nome           VARCHAR(255) NOT NULL,
  email          VARCHAR(255) NULL,
  telefone       VARCHAR(50)  NULL,
  empresa        VARCHAR(255) NULL,
  origem         VARCHAR(100) NULL,                       -- utm_source
  status         VARCHAR(50)  NOT NULL DEFAULT 'novo',
  estagio        VARCHAR(30)  NOT NULL DEFAULT 'prospeccao',
  observacao     TEXT         NULL,
  cliente_id     INT          NULL,                       -- preenchido na conversão
  responsavel_id INT          NULL,
  data_criacao   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leads_cliente     FOREIGN KEY (cliente_id)     REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_responsavel FOREIGN KEY (responsavel_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_leads_estagio (estagio),
  INDEX idx_leads_responsavel (responsavel_id)
);

-- Oportunidades (uma ou mais por lead).
CREATE TABLE IF NOT EXISTS oportunidades (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  lead_id                  INT NOT NULL,
  titulo                   VARCHAR(255) NOT NULL,
  valor_estimado           DECIMAL(15,2) NOT NULL DEFAULT 0,
  estagio                  VARCHAR(30)  NOT NULL DEFAULT 'prospeccao',
  probabilidade            INT          NOT NULL DEFAULT 0,   -- 0..100
  data_prevista_fechamento DATE         NULL,
  data_criacao             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_oport_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_oport_lead (lead_id)
);

-- Interações (histórico polimórfico: lead OU cliente).
CREATE TABLE IF NOT EXISTS interacoes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  lead_id    INT NULL,
  cliente_id INT NULL,
  tipo       VARCHAR(30) NOT NULL,   -- ligacao/email/reuniao/nota/mudanca_estagio
  descricao  TEXT NULL,
  data       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_id INT NULL,
  CONSTRAINT fk_inter_lead    FOREIGN KEY (lead_id)    REFERENCES leads(id)    ON DELETE CASCADE,
  CONSTRAINT fk_inter_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  CONSTRAINT fk_inter_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_inter_lead (lead_id),
  INDEX idx_inter_cliente (cliente_id)
);

-- Atividades (tarefas agendadas).
CREATE TABLE IF NOT EXISTS atividades (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  lead_id             INT NULL,
  tipo                VARCHAR(30) NULL,
  descricao           VARCHAR(255) NULL,
  data_vencimento     DATETIME NULL,
  concluida           TINYINT(1) NOT NULL DEFAULT 0,
  usuario_responsavel INT NULL,
  data_criacao        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ativ_lead    FOREIGN KEY (lead_id)             REFERENCES leads(id)    ON DELETE CASCADE,
  CONSTRAINT fk_ativ_usuario FOREIGN KEY (usuario_responsavel) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_ativ_lead (lead_id)
);

-- Rastreabilidade de conversão no lado do cliente.
-- (Rode só se a coluna ainda não existir.)
ALTER TABLE clientes ADD COLUMN lead_origem_id INT NULL;

-- Permissão da seção CRM (dirige a UI do GM e a regra de visibilidade).
-- (Rode só se a coluna ainda não existir.)
ALTER TABLE usuarios ADD COLUMN acesso_crm VARCHAR(20) NOT NULL DEFAULT 'nenhum';
