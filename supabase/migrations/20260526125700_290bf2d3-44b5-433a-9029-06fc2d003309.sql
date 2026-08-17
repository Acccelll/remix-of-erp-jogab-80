
DO $$
DECLARE
  t text;
  p text;
  tables text[] := ARRAY[
    'colaboradores','controle_despesas','decimo_terceiro','documento_tipos',
    'fopag_entries','formas_pagamento','funcoes','historico_salarial',
    'horas_extras','mobilizacoes_periodos','mobilizacoes_veiculos','obras',
    'patrimonios','players','provisoes','solicitacao_comentarios',
    'solicitacoes_financeiras','veiculos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
