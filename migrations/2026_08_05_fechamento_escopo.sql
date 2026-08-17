-- ============================================================
-- Migração: escopo do fechamento de competência (folha | ponto)
-- Data: 2026-08-05
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: `dp_fechamento_competencia` trava a competência da **folha**. O
-- ponto não tem trava nenhuma — dá para re-sincronizar um mês já pago pela
-- RHiD e mudar a base de uma folha fechada, sem registro de que mudou.
--
-- Por que um escopo em vez de reusar a trava única: ponto e folha fecham em
-- momentos diferentes. O DP fecha o ponto para congelar a base, confere a
-- conciliação Ponto × Folha e só então fecha a folha. Uma trava só forçaria os
-- dois a acontecerem juntos, que é o contrário do fluxo real.
--
-- Compatibilidade: `escopo` entra com DEFAULT 'folha', então toda linha
-- existente continua sendo fechamento de folha e o comportamento atual do
-- módulo Fopag não muda. As rotas passam a filtrar por escopo.
--
-- Reversão: `ALTER TABLE dp_fechamento_competencia DROP COLUMN escopo`.
-- Idempotente: usa a procedure `AddColumnIfNotExists` já existente no banco.

CALL AddColumnIfNotExists(
  'dp_fechamento_competencia',
  'escopo',
  "VARCHAR(10) NOT NULL DEFAULT 'folha'"
);
