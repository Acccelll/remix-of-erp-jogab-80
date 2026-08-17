-- Final pass: remove remaining direct USING true read policies where scoping is available.

DROP POLICY IF EXISTS "board_campos_select" ON public.board_campos;
CREATE POLICY "board_campos_select_por_board"
ON public.board_campos
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_campos.board_id
      AND (
        (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_em_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "causas_select_auth" ON public.causas_nao_conclusao;
CREATE POLICY "causas_select_planejamento_operacao"
ON public.causas_nao_conclusao
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Planejamento')
  OR public.current_has_setor('Engenharia')
  OR public.current_has_setor('Producao')
  OR public.current_has_setor('Produção')
  OR public.current_has_setor('Qualidade')
);

DROP POLICY IF EXISTS "cronograma_calendario_excecoes select" ON public.cronograma_calendario_excecoes;
CREATE POLICY "cronograma_calendario_excecoes select por obra"
ON public.cronograma_calendario_excecoes
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1
    FROM public.cronograma_calendarios c
    WHERE c.id = cronograma_calendario_excecoes.calendario_id
      AND public.user_em_obra(c.obra_id)
  )
);

DROP POLICY IF EXISTS "empresas select" ON public.empresas;
CREATE POLICY "empresas select vinculadas"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR EXISTS (
    SELECT 1
    FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid()
      AND ue.empresa_id = empresas.id
  )
);

CREATE INDEX IF NOT EXISTS idx_board_campos_board_id ON public.board_campos (board_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_calendario_excecoes_calendario_id ON public.cronograma_calendario_excecoes (calendario_id);