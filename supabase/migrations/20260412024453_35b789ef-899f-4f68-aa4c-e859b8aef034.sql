
DROP POLICY IF EXISTS "Authenticated access solicitacoes_financeiras" ON public.solicitacoes_financeiras;
CREATE POLICY "Allow all access to solicitacoes_financeiras" ON public.solicitacoes_financeiras FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access solicitacao_comentarios" ON public.solicitacao_comentarios;
CREATE POLICY "Allow all access to solicitacao_comentarios" ON public.solicitacao_comentarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access controle_despesas" ON public.controle_despesas;
CREATE POLICY "Allow all access to controle_despesas" ON public.controle_despesas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Allow all access to formas_pagamento" ON public.formas_pagamento FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access historico_salarial" ON public.historico_salarial;
CREATE POLICY "Allow all access to historico_salarial" ON public.historico_salarial FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access horas_extras" ON public.horas_extras;
CREATE POLICY "Allow all access to horas_extras" ON public.horas_extras FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access fopag_entries" ON public.fopag_entries;
CREATE POLICY "Allow all access to fopag_entries" ON public.fopag_entries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access provisoes" ON public.provisoes;
CREATE POLICY "Allow all access to provisoes" ON public.provisoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access decimo_terceiro" ON public.decimo_terceiro;
CREATE POLICY "Allow all access to decimo_terceiro" ON public.decimo_terceiro FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated access mobilizacoes_periodos" ON public.mobilizacoes_periodos;
CREATE POLICY "Allow all access to mobilizacoes_periodos" ON public.mobilizacoes_periodos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
