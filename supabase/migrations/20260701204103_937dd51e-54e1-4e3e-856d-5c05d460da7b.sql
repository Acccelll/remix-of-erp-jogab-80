DROP POLICY IF EXISTS "board_membros_write_owner" ON public.board_membros;

CREATE POLICY "board_membros_write_owner_sem_escalonamento"
ON public.board_membros
FOR ALL
TO authenticated
USING (
  public.is_gm_user(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_membros.board_id
      AND b.owner_id = auth.uid()
  )
)
WITH CHECK (
  public.is_gm_user(auth.uid())
  OR (
    papel IN ('membro'::public.board_papel, 'observador'::public.board_papel)
    AND EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.id = board_membros.board_id
        AND b.owner_id = auth.uid()
    )
  )
);