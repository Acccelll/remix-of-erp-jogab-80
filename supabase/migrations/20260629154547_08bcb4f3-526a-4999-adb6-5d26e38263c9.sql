-- Auto-cria profile com is_gm=true para todo usuário autenticado (modo teste).
-- Garante que RLS de obras (que exige GM ou empresa) deixe os dados aparecerem
-- enquanto a estrutura de empresas/usuários não está povoada.

CREATE OR REPLACE FUNCTION public.ensure_profile_is_gm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_gm)
  VALUES (NEW.id, COALESCE(NEW.email, ''), true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_is_gm_trg ON auth.users;
CREATE TRIGGER ensure_profile_is_gm_trg
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_is_gm();

-- Backfill: todos os usuários atuais viram GM (teste).
INSERT INTO public.profiles (id, email, is_gm)
SELECT u.id, COALESCE(u.email, ''), true
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET is_gm = true;

-- Consolida: move as obras "bootstrap" para a Empresa Principal,
-- para que apareçam mesmo quando o GM filtrar por essa empresa.
UPDATE public.obras
SET empresa_id = 'f6033674-9c60-4896-9855-b9ba7fbede4b'
WHERE empresa_id = 'd9c3672d-0b07-4812-9b9d-d25f2d2d175d';