-- PRO-030: notificação dirigida por usuário — comentário avisa quem criou a solicitação

-- Destinatário individual. Até aqui `notificacoes` só entregava por setor
-- (`role_scope`), então não havia como avisar UMA pessoa — o criador de uma
-- solicitação só era alcançado por acidente, quando pertencia ao setor avisado.
--
-- TEXT, e não uuid: o id vem do backend legado MySQL (`usuarios.id`, INT), que
-- é um espaço de identidade distinto do `auth.uid()` do Supabase (contas
-- provisionadas em paralelo como `{login}@planifik.local`).
--
-- Isto é ROTEAMENTO DE ENTREGA, não fronteira de segurança: as políticas de
-- RLS desta tabela seguem `USING (true)`, como já eram antes desta migration.
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS destinatario_id TEXT;

-- `role_scope` é NOT NULL e restrito a compras|financeiro. Notificação dirigida
-- não pertence a setor nenhum, daí 'user' — que também é o valor que
-- `notificacoesRepo.insertCard` já gravava, violando o CHECK.
ALTER TABLE public.notificacoes
  DROP CONSTRAINT IF EXISTS notificacoes_role_scope_check;
ALTER TABLE public.notificacoes
  ADD CONSTRAINT notificacoes_role_scope_check
  CHECK (role_scope IN ('compras','financeiro','user'));

-- Mesmo motivo do retipo de `lida_por` (UUID[] -> TEXT[]) em 20260702114004: o
-- cliente grava ids do MySQL, não uuids. Enquanto a coluna era `uuid`, todo
-- INSERT que enviava `autor_id` falhava com "invalid input syntax for type
-- uuid" — erro engolido pelo catch de `criarNotificacao`. Na prática nenhuma
-- notificação de solicitação financeira chegava ao banco.
ALTER TABLE public.notificacoes
  ALTER COLUMN autor_id TYPE TEXT USING autor_id::TEXT;

CREATE INDEX IF NOT EXISTS idx_notificacoes_destinatario
  ON public.notificacoes(destinatario_id, created_at DESC);
