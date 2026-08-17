-- ============================================================
-- CRM — Rename global: "lead" vira "oportunidade"
-- Aplicar manualmente no MySQL do host (jogabcom_gestao_obras).
--
-- ORDEM DE DEPLOY (tudo no mesmo momento):
--   1) Rodar esta migração no banco;
--   2) Publicar o api.php novo (rotas oportunidades/oportunidadeEstagio/
--      oportunidadeConverter/oportunidadeComentarios);
--   3) Publicar o build novo do frontend.
-- A versão antiga do frontend/API deixa de funcionar para o CRM após a
-- migração (quebra limpa, sem aliases) — basta recarregar o app.
--
-- A tabela `oportunidades` antiga está vazia e sem uso (nada a alimentava);
-- ela é dropada para a tabela `leads` assumir o nome.
-- ============================================================

-- 1) Sai da frente a tabela morta e `leads` assume o nome.
DROP TABLE oportunidades;
RENAME TABLE leads TO oportunidades;

-- 2) Colunas de referência.
ALTER TABLE interacoes RENAME COLUMN lead_id TO oportunidade_id;
ALTER TABLE atividades RENAME COLUMN lead_id TO oportunidade_id;
ALTER TABLE lead_comentarios RENAME COLUMN lead_id TO oportunidade_id;
RENAME TABLE lead_comentarios TO oportunidade_comentarios;
ALTER TABLE clientes RENAME COLUMN lead_origem_id TO oportunidade_origem_id;

-- 3) Histórico: crmStats(tipo=conversao) casa por esta string exata.
UPDATE interacoes
   SET descricao = 'Oportunidade convertida em cliente'
 WHERE descricao = 'Lead convertido em cliente';

-- 4) Limpeza dos nomes de índices que mencionam "lead".
ALTER TABLE oportunidades RENAME INDEX idx_leads_estagio TO idx_oport_estagio;
ALTER TABLE oportunidades RENAME INDEX idx_leads_responsavel TO idx_oport_responsavel;
ALTER TABLE oportunidades RENAME INDEX fk_leads_cliente TO fk_oport_cliente_idx;
ALTER TABLE interacoes RENAME INDEX idx_inter_lead TO idx_inter_oport;
ALTER TABLE atividades RENAME INDEX idx_ativ_lead TO idx_ativ_oport;
ALTER TABLE oportunidade_comentarios RENAME INDEX idx_lead_coment_lead TO idx_oport_coment_oport;

-- 5) Constraints (FK não tem RENAME direto: drop + add com nome novo).
ALTER TABLE oportunidades
  DROP FOREIGN KEY fk_leads_cliente,
  ADD CONSTRAINT fk_oport_cliente FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE SET NULL;
ALTER TABLE oportunidades
  DROP FOREIGN KEY fk_leads_responsavel,
  ADD CONSTRAINT fk_oport_responsavel FOREIGN KEY (responsavel_id) REFERENCES usuarios (id) ON DELETE SET NULL;
ALTER TABLE interacoes
  DROP FOREIGN KEY fk_inter_lead,
  ADD CONSTRAINT fk_inter_oport FOREIGN KEY (oportunidade_id) REFERENCES oportunidades (id) ON DELETE CASCADE;
ALTER TABLE atividades
  DROP FOREIGN KEY fk_ativ_lead,
  ADD CONSTRAINT fk_ativ_oport FOREIGN KEY (oportunidade_id) REFERENCES oportunidades (id) ON DELETE CASCADE;
ALTER TABLE oportunidade_comentarios
  DROP FOREIGN KEY fk_lead_coment_lead,
  ADD CONSTRAINT fk_oport_coment_oport FOREIGN KEY (oportunidade_id) REFERENCES oportunidades (id) ON DELETE CASCADE;
