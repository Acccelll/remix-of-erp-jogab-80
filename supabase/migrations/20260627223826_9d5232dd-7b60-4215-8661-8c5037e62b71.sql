
-- 1) Tabela de empresas
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE,
  ativa BOOLEAN NOT NULL DEFAULT true,
  cor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas select"
  ON public.empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "empresas insert gm"
  ON public.empresas FOR INSERT TO authenticated
  WITH CHECK (public.current_is_gm());
CREATE POLICY "empresas update gm"
  ON public.empresas FOR UPDATE TO authenticated
  USING (public.current_is_gm()) WITH CHECK (public.current_is_gm());
CREATE POLICY "empresas delete gm"
  ON public.empresas FOR DELETE TO authenticated
  USING (public.current_is_gm());

CREATE TRIGGER trg_empresas_updated_at BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Vínculo usuário ↔ empresa
CREATE TABLE public.user_empresas (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'operador', -- gestor|operador|viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, empresa_id)
);
CREATE INDEX idx_user_empresas_empresa ON public.user_empresas(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_empresas TO authenticated;
GRANT ALL ON public.user_empresas TO service_role;
ALTER TABLE public.user_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_empresas select"
  ON public.user_empresas FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_is_gm());
CREATE POLICY "user_empresas write gm"
  ON public.user_empresas FOR ALL TO authenticated
  USING (public.current_is_gm())
  WITH CHECK (public.current_is_gm());

-- 3) Helpers de identidade no padrão anti-recursão
CREATE OR REPLACE FUNCTION public.current_empresas()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_is_gm() THEN
      COALESCE((SELECT array_agg(id) FROM public.empresas), '{}'::uuid[])
    ELSE
      COALESCE(
        (SELECT array_agg(empresa_id) FROM public.user_empresas WHERE user_id = auth.uid()),
        '{}'::uuid[]
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_em_empresa(p_empresa uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_is_gm() OR EXISTS (
    SELECT 1 FROM public.user_empresas
    WHERE user_id = auth.uid() AND empresa_id = p_empresa
  );
$$;

-- 4) Seed: cria "Empresa Principal" e vincula todos os usuários existentes
DO $$
DECLARE v_emp_id UUID;
BEGIN
  INSERT INTO public.empresas (razao_social, nome_fantasia, ativa)
  VALUES ('Empresa Principal', 'Empresa Principal', true)
  RETURNING id INTO v_emp_id;

  INSERT INTO public.user_empresas (user_id, empresa_id, papel)
  SELECT p.id, v_emp_id, CASE WHEN COALESCE(p.is_gm, false) THEN 'gestor' ELSE 'operador' END
  FROM public.profiles p
  ON CONFLICT DO NOTHING;
END $$;
