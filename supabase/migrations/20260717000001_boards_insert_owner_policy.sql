-- Kanban · corrige erro "new row violates row-level security policy for table boards"
-- ao criar quadro custom. Garante policy de INSERT baseada em owner_id = auth.uid().
--
-- Aplicar via Supabase SQL Editor no projeto uyojfkzccgqxqzxaumpj.

-- Garante RLS habilitado.
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Grants Data-API (idempotentes).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;

-- Recria policy de INSERT: qualquer usuário autenticado pode criar um board
-- desde que o owner_id do novo registro seja o próprio auth.uid().
DROP POLICY IF EXISTS "boards_insert_owner" ON public.boards;
CREATE POLICY "boards_insert_owner"
  ON public.boards
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Policy de UPDATE/DELETE do próprio board (idempotente).
DROP POLICY IF EXISTS "boards_update_owner" ON public.boards;
CREATE POLICY "boards_update_owner"
  ON public.boards
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "boards_delete_owner" ON public.boards;
CREATE POLICY "boards_delete_owner"
  ON public.boards
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
