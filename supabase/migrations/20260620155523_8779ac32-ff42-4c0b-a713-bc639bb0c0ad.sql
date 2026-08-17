
-- ============================================
-- ETAPA 1 — Auth base schema
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('gm','engenharia','dp','financeiro','compras','seguranca','comum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id text,
  login text UNIQUE,
  nome text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles select own or gm" ON public.profiles;
CREATE POLICY "profiles select authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  nivel int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles select own" ON public.user_roles;
CREATE POLICY "user_roles select own" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security-definer role helper (no recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, login, nome)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'login', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger on profiles
DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================
-- ETAPA 3 — Endurecer policies (default: authenticated only)
-- ============================================

-- Helper: drop the permissive "planifik" policies and replace with authenticated-only
DO $do$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND (
        policyname LIKE '% planifik'
        OR policyname = 'dp_holerite full access'
        OR policyname = 'auth full access custo_colaborador_competencia'
        OR policyname = 'Acesso público responsabilidades_patrimonios'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$do$;

-- Recreate as authenticated-only for each affected table
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'aditivos_contrato','audit_logs','bms_previstas','bms_redistribuicao',
    'centros_custo_totvs','clientes','cronograma_baselines','cronograma_dependencias',
    'cronograma_item_baseline','cronograma_item_revisoes','cronograma_itens','cronograma_marcos',
    'cronograma_revisoes','custo_colaborador_competencia','dp_holerite',
    'financeiro_lancamentos','financeiro_rateios','financeiro_snapshots',
    'itens_medicao','licoes_aprendidas','medicoes','notas_fiscais','ocorrencias',
    'plano_contas','recebimentos','responsabilidades_patrimonios','riscos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_auth_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)',
      t || '_auth_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      t || '_auth_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)',
      t || '_auth_delete', t);
  END LOOP;
END
$do$;

-- Tabelas que o front lê via cliente Supabase mas que ainda não tinham policy
-- (RLS já habilitado, default deny → precisam de policy authenticated)
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'players','obras','colaboradores','patrimonios','veiculos','funcoes',
    'documento_tipos','mobilizacoes_periodos','mobilizacoes_veiculos',
    'formas_pagamento','solicitacoes_financeiras','solicitacao_comentarios',
    'controle_despesas','fopag_entries','decimo_terceiro','historico_salarial',
    'horas_extras','provisoes'
  ];
  has_rls boolean;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- only act if table exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      -- drop any old broad policies first
      FOR has_rls IN SELECT true FROM pg_policies WHERE schemaname='public' AND tablename=t
      LOOP NULL; END LOOP;
      EXECUTE format(
        'DO $inner$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=''public'' AND tablename=%L AND policyname=%L) THEN
             EXECUTE %L;
           END IF;
         END $inner$;',
        t, t || '_auth_select',
        format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_auth_select', t)
      );
      EXECUTE format(
        'DO $inner$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=''public'' AND tablename=%L AND policyname=%L) THEN
             EXECUTE %L;
           END IF;
         END $inner$;',
        t, t || '_auth_insert',
        format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t || '_auth_insert', t)
      );
      EXECUTE format(
        'DO $inner$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=''public'' AND tablename=%L AND policyname=%L) THEN
             EXECUTE %L;
           END IF;
         END $inner$;',
        t, t || '_auth_update',
        format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t || '_auth_update', t)
      );
      EXECUTE format(
        'DO $inner$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname=''public'' AND tablename=%L AND policyname=%L) THEN
             EXECUTE %L;
           END IF;
         END $inner$;',
        t, t || '_auth_delete',
        format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', t || '_auth_delete', t)
      );
    END IF;
  END LOOP;
END
$do$;

-- ============================================
-- ETAPA 4 — Lockdown SECURITY DEFINER functions
-- ============================================
-- Funções internas (apenas triggers/admin): revogar de anon e authenticated
REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_seed_plano_contas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_previsao_nf(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_reverter_faturamento_bms(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_apos_faturamento(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_lancamento_solicitacao_aprovada(uuid, uuid, text, numeric, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_dp_holerite_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_bump_versao_otimista() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_custo_colab_updated_at() FROM PUBLIC, anon, authenticated;

-- get_folha_rateada é chamada pelo front → authenticated only
REVOKE EXECUTE ON FUNCTION public.get_folha_rateada(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_folha_rateada(text, text) TO authenticated, service_role;

-- Garante service_role em todas (necessário para edge functions / chamadas de trigger)
GRANT EXECUTE ON FUNCTION public.fn_audit_row() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_seed_plano_contas() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recalcular_previsao_nf(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_reverter_faturamento_bms(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_recalcular_apos_faturamento(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_importar_financeiro_snapshot(text, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_lancamento_solicitacao_aprovada(uuid, uuid, text, numeric, date, text) TO service_role;
