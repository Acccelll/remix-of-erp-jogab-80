-- Almoxarifado e Frotas viram setores atribuíveis.
--
-- Os dois já existiam como rótulo legado da lista antiga da Aprovação
-- Financeira, colapsados em `compras`/`engenharia` porque não havia setor
-- correspondente. Agora têm o seu, para que manutenção seja solicitada no setor
-- certo. Espelha SETORES_SUPABASE (src/lib/authz/paginas.ts), setoresValidosFin()
-- (api.php) e SETORES_VALIDOS (supabase/functions/sync-player-auth).
--
-- Sem acento nos dois, então o accent-folding de current_has_setor() não muda
-- nada aqui. Os setores só chegam ao RLS no próximo login do usuário, quando a
-- edge sync-player-auth reescreve public.user_roles.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'almoxarifado';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'frotas';
