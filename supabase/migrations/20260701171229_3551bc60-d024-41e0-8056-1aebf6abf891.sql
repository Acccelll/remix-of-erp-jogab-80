-- Remove políticas antigas de storage que deixavam anexos de cards acessíveis sem validação de card.
DROP POLICY IF EXISTS "card-anexos select" ON storage.objects;
DROP POLICY IF EXISTS "card-anexos insert" ON storage.objects;
DROP POLICY IF EXISTS "card-anexos update" ON storage.objects;
DROP POLICY IF EXISTS "card-anexos delete" ON storage.objects;

-- Colaboradores: dados pessoais ficam restritos a GM ou RH vinculado à obra atual do colaborador.
DROP POLICY IF EXISTS "colaboradores_select_rh" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores write rh" ON public.colaboradores;

CREATE POLICY "colaboradores select por rh da obra ou gm"
ON public.colaboradores
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('rh')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.user_em_obra(obra_atual_id::uuid)
  )
);

CREATE POLICY "colaboradores write por rh da obra ou gm"
ON public.colaboradores
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    public.current_has_setor('rh')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.user_pode_editar_obra(obra_atual_id::uuid)
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    public.current_has_setor('rh')
    AND obra_atual_id IS NOT NULL
    AND obra_atual_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.user_pode_editar_obra(obra_atual_id::uuid)
  )
);

-- Clientes: deixa de ser visível a todo usuário autenticado.
DROP POLICY IF EXISTS "cli_select" ON public.clientes;

CREATE POLICY "clientes select por financeiro gm ou obra"
ON public.clientes
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('financeiro')
  OR EXISTS (
    SELECT 1
    FROM public.obras o
    WHERE o.cliente_id = clientes.id
      AND public.user_em_obra(o.id)
  )
);

-- Fornecedores: restringe leitura a GM, compras ou financeiro.
DROP POLICY IF EXISTS "fornecedores read" ON public.fornecedores;

CREATE POLICY "fornecedores read por compras financeiro ou gm"
ON public.fornecedores
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR public.current_has_setor('Compras')
  OR public.current_has_setor('compras')
  OR public.current_has_setor('financeiro')
);

-- Boards de obra: acesso passa a depender da obra relacionada.
DROP POLICY IF EXISTS "boards select" ON public.boards;
DROP POLICY IF EXISTS "boards write" ON public.boards;

CREATE POLICY "boards select por escopo"
ON public.boards
FOR SELECT
TO authenticated
USING (
  public.current_is_gm()
  OR (
    tipo = 'setor'
    AND setor IS NOT NULL
    AND public.current_has_setor(setor)
  )
  OR (
    tipo = 'obra'
    AND obra_id IS NOT NULL
    AND public.user_em_obra(obra_id)
  )
  OR (
    tipo = 'custom'
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "boards write por escopo"
ON public.boards
FOR ALL
TO authenticated
USING (
  public.current_is_gm()
  OR (
    tipo = 'setor'
    AND setor IS NOT NULL
    AND public.current_has_setor(setor)
  )
  OR (
    tipo = 'obra'
    AND obra_id IS NOT NULL
    AND public.user_pode_editar_obra(obra_id)
  )
  OR (
    tipo = 'custom'
    AND owner_id = auth.uid()
  )
)
WITH CHECK (
  public.current_is_gm()
  OR (
    tipo = 'setor'
    AND setor IS NOT NULL
    AND public.current_has_setor(setor)
  )
  OR (
    tipo = 'obra'
    AND obra_id IS NOT NULL
    AND public.user_pode_editar_obra(obra_id)
  )
  OR (
    tipo = 'custom'
    AND owner_id = auth.uid()
  )
);

-- Listas seguem o acesso do board pai, sem depender apenas da existência do ID.
DROP POLICY IF EXISTS "board_listas select" ON public.board_listas;
DROP POLICY IF EXISTS "board_listas write" ON public.board_listas;

CREATE POLICY "board_listas select por board acessivel"
ON public.board_listas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_listas.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_em_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

CREATE POLICY "board_listas write por board editavel"
ON public.board_listas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_listas.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_pode_editar_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = board_listas.board_id
      AND (
        public.current_is_gm()
        OR (b.tipo = 'setor' AND b.setor IS NOT NULL AND public.current_has_setor(b.setor))
        OR (b.tipo = 'obra' AND b.obra_id IS NOT NULL AND public.user_pode_editar_obra(b.obra_id))
        OR (b.tipo = 'custom' AND b.owner_id = auth.uid())
      )
  )
);

-- Seções visíveis seguem o acesso real ao card.
DROP POLICY IF EXISTS "card_secoes_visiveis_select" ON public.card_secoes_visiveis;
DROP POLICY IF EXISTS "card_secoes_visiveis_write" ON public.card_secoes_visiveis;

CREATE POLICY "card_secoes_visiveis select por card"
ON public.card_secoes_visiveis
FOR SELECT
TO authenticated
USING (public.has_card_access(card_id));

CREATE POLICY "card_secoes_visiveis write por card"
ON public.card_secoes_visiveis
FOR ALL
TO authenticated
USING (public.has_card_access(card_id))
WITH CHECK (public.has_card_access(card_id));

-- Perguntas de inspeção seguem visibilidade/edição do modelo.
DROP POLICY IF EXISTS "perguntas seguem permissao do modelo" ON public.inspecao_perguntas;

CREATE POLICY "perguntas select por modelo visivel"
ON public.inspecao_perguntas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.inspecao_modelos m
    WHERE m.id = inspecao_perguntas.modelo_id
      AND (
        m.publicado = true
        OR public.current_is_gm()
        OR 'Qualidade' = ANY(public.current_setores())
        OR 'Engenharia' = ANY(public.current_setores())
        OR 'Segurança' = ANY(public.current_setores())
      )
  )
);

CREATE POLICY "perguntas write por modelo editavel"
ON public.inspecao_perguntas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.inspecao_modelos m
    WHERE m.id = inspecao_perguntas.modelo_id
      AND (
        public.current_is_gm()
        OR 'Qualidade' = ANY(public.current_setores())
        OR 'Engenharia' = ANY(public.current_setores())
        OR 'Segurança' = ANY(public.current_setores())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.inspecao_modelos m
    WHERE m.id = inspecao_perguntas.modelo_id
      AND (
        public.current_is_gm()
        OR 'Qualidade' = ANY(public.current_setores())
        OR 'Engenharia' = ANY(public.current_setores())
        OR 'Segurança' = ANY(public.current_setores())
      )
  )
);