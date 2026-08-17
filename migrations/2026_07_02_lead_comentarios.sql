-- ============================================================
-- CRM — Comentários de oportunidades (leads)
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
-- Mesmo padrão de solicitacao_comentarios (Aprovação Financeira), com
-- updated_at para rastrear edições.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_comentarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  lead_id    INT NOT NULL,
  texto      TEXT NOT NULL,
  autor      VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_coment_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_lead_coment_lead (lead_id)
);
