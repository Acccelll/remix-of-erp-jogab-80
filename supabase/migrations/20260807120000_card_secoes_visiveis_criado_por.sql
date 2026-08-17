-- KAN-001: reconcilia `card_secoes_visiveis.criado_por` entre o ledger e o banco vivo
--
-- Sintoma: "Adicionar ao cartão" (Trello "Add to card") falhava com
--   PGRST204 · Could not find the 'criado_por' column of 'card_secoes_visiveis'
--             in the schema cache
--
-- Causa: divergência entre o ledger e o banco vivo. A migration original
-- (20260630140538) criou a tabela COM `criado_por`; a consolidação
-- 20260722114221 recria a mesma tabela SEM a coluna, sob `IF NOT EXISTS` —
-- num rebuild a coluna existe, no banco vivo (que veio pela consolidação) não.
-- A UI mandava a coluna no upsert e quebrava só em produção.
--
-- A UI deixou de enviar `criado_por` (a autoria agora vem do `default` abaixo),
-- então esta migration é convergência de schema: torna as duas realidades
-- iguais sem depender de ordem de aplicação.
--
-- Sem FK para `profiles`: a coluna original também não tinha, e um usuário
-- autenticado sem linha em `profiles` faria o INSERT falhar — trocaria um erro
-- de schema por um erro de integridade no mesmo botão.

ALTER TABLE public.card_secoes_visiveis
  ADD COLUMN IF NOT EXISTS criado_por uuid;

-- Autoria preenchida pelo banco: o cliente nunca precisa (nem deve) mandá-la.
ALTER TABLE public.card_secoes_visiveis
  ALTER COLUMN criado_por SET DEFAULT auth.uid();

COMMENT ON COLUMN public.card_secoes_visiveis.criado_por IS
  'Auditoria: quem registrou a seção. Preenchida por default auth.uid(); a UI não envia esta coluna.';

-- PostgREST mantém o schema em cache; sem isto a coluna nova só aparece no
-- próximo restart do serviço.
NOTIFY pgrst, 'reload schema';
