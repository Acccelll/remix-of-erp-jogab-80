
-- Fase 2 Onda B: aplicar user_em_obra() em SELECT de tabelas com obra_id

-- rdo
DROP POLICY IF EXISTS "rdo read" ON public.rdo;
CREATE POLICY "rdo read" ON public.rdo FOR SELECT
  USING (current_is_gm() OR public.user_em_obra(obra_id));

-- cronograma_itens
DROP POLICY IF EXISTS "cronograma_itens select" ON public.cronograma_itens;
CREATE POLICY "cronograma_itens select" ON public.cronograma_itens FOR SELECT
  USING (current_is_gm() OR public.user_em_obra(obra_id));

-- financeiro_lancamentos: mantém financeiro global; membros da obra também leem
DROP POLICY IF EXISTS "financeiro_lancamentos_select_fin" ON public.financeiro_lancamentos;
CREATE POLICY "financeiro_lancamentos_select_fin" ON public.financeiro_lancamentos FOR SELECT
  USING (
    current_is_gm()
    OR current_has_setor('financeiro')
    OR (obra_id IS NOT NULL AND public.user_em_obra(obra_id))
  );

-- pacotes_trabalho
DROP POLICY IF EXISTS "pacotes_select_auth" ON public.pacotes_trabalho;
CREATE POLICY "pacotes_select_auth" ON public.pacotes_trabalho FOR SELECT
  USING (current_is_gm() OR public.user_em_obra(obra_id));

-- restricoes
DROP POLICY IF EXISTS "restricoes_select_auth" ON public.restricoes;
CREATE POLICY "restricoes_select_auth" ON public.restricoes FOR SELECT
  USING (current_is_gm() OR public.user_em_obra(obra_id));
