-- Resolve o login do usuário autenticado (perfil ou metadados do JWT)
CREATE OR REPLACE FUNCTION public.current_login()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT lower(trim(pr.login)) FROM public.profiles pr WHERE pr.id = auth.uid()),
    lower(trim(NULLIF(auth.jwt() -> 'user_metadata' ->> 'login', ''))),
    lower(trim(NULLIF(split_part(COALESCE(auth.jwt() ->> 'email', ''), '@', 1), '')))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.current_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_login() TO authenticated, service_role;

-- Papéis considerando todas as identidades que compartilham o mesmo login
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = _role
  ) OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.user_roles r ON r.user_id = pr.id
    WHERE r.role = _role
      AND public.current_login() IS NOT NULL
      AND lower(trim(pr.login)) = public.current_login()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_has_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO authenticated, service_role;

-- GM por login (não mais dependente do id da conta)
CREATE OR REPLACE FUNCTION public.is_current_player_gm()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players pl
    WHERE pl.is_gm = true
      AND public.current_login() IS NOT NULL
      AND lower(trim(pl.login)) = public.current_login()
  ) OR COALESCE((auth.jwt() -> 'user_metadata' ->> 'is_gm')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.current_player_has_access(_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.players pl
    WHERE public.current_login() IS NOT NULL
      AND lower(trim(pl.login)) = public.current_login()
      AND (
        pl.is_gm = true
        OR COALESCE(pl.acessos ->> _module, 'nenhum') IN ('editar', 'visualizar')
      )
  ) OR public.is_current_player_gm();
$$;

-- Checagem de permissão da importação da Matriz SQL
CREATE OR REPLACE FUNCTION public.fn_importar_matriz_pode()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
     OR (auth.uid() IS NOT NULL AND (
          public.current_user_has_role('financeiro')
          OR public.current_user_has_role('gm')
          OR public.is_current_player_gm()
          OR public.current_player_has_access('financeiro')
        ));
$$;

REVOKE EXECUTE ON FUNCTION public.fn_importar_matriz_pode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_importar_matriz_pode() TO authenticated, service_role;
