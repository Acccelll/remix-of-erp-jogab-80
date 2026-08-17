-- Make sensitive write coverage explicit instead of relying on broad FOR ALL policies.

DROP POLICY IF EXISTS "colaboradores write gm ou rh gestor da obra" ON public.colaboradores;

CREATE POLICY "colaboradores insert gm ou rh gestor da obra"
ON public.colaboradores
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
);

CREATE POLICY "colaboradores update gm ou rh gestor da obra"
ON public.colaboradores
FOR UPDATE
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
);

CREATE POLICY "colaboradores delete gm ou rh gestor da obra"
ON public.colaboradores
FOR DELETE
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('RH')
    AND public.safe_uuid(obra_atual_id) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.obra_membros om
      WHERE om.user_id = auth.uid()
        AND om.obra_id = public.safe_uuid(colaboradores.obra_atual_id)
        AND lower(coalesce(om.papel, '')) = 'gestor'
    )
  )
);

DROP POLICY IF EXISTS "board_membros_write_owner_sem_escalonamento" ON public.board_membros;

CREATE POLICY "board_membros_insert_owner_sem_escalonamento"
ON public.board_membros
FOR INSERT
TO authenticated
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

CREATE POLICY "board_membros_update_owner_sem_escalonamento"
ON public.board_membros
FOR UPDATE
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

CREATE POLICY "board_membros_delete_owner"
ON public.board_membros
FOR DELETE
TO authenticated
USING (
  public.is_gm_user(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_membros.board_id
      AND b.owner_id = auth.uid()
  )
);