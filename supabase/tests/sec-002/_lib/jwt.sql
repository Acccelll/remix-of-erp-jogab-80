-- SEC-002 JWT helpers locais à sessão de teste.
create or replace function pg_temp.set_jwt_user(_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', _uid, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function pg_temp.set_jwt_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;
-- ============================================================================
-- SEC-002.tests-02.fixtures-01.materialize-01 (R192b) — helpers por perfil.
-- Prefixo (linhas 1-23) preservado byte-a-byte. Sem security definer, sem DDL
-- fora de create or replace function pg_temp.*.
-- ============================================================================
create or replace function pg_temp.set_jwt_gm()
returns void language plpgsql as $$
begin perform pg_temp.set_jwt_user('99999999-9999-9999-9999-999999999999'::uuid); end;
$$;

create or replace function pg_temp.set_jwt_member(_lote text)
returns void language plpgsql as $$
begin
  case upper(_lote)
    when 'B' then perform pg_temp.set_jwt_user('11111111-1111-1111-1111-111111111111'::uuid);
    when 'C' then perform pg_temp.set_jwt_user('11111111-1111-1111-1111-111111111111'::uuid);
    when 'D' then perform pg_temp.set_jwt_user('55555555-0000-0000-0000-000000000001'::uuid);
    when 'E' then perform pg_temp.set_jwt_user('44444442-0000-0000-0000-000000000002'::uuid);
    else raise exception 'FIX01: unknown batch %', _lote;
  end case;
end;
$$;

create or replace function pg_temp.set_jwt_outsider()
returns void language plpgsql as $$
begin perform pg_temp.set_jwt_user('66666666-0000-0000-0000-000000000001'::uuid); end;
$$;

create or replace function pg_temp.set_jwt_owner()
returns void language plpgsql as $$
begin perform pg_temp.set_jwt_user('11111111-1111-1111-1111-111111111111'::uuid); end;
$$;

create or replace function pg_temp.set_jwt_segregation()
returns void language plpgsql as $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='user_setores'
  ) then
    raise notice 'SKIP D-3: user_setores absent, segregation profile unavailable';
    return;
  end if;
  perform pg_temp.set_jwt_user('55555555-0000-0000-0000-000000000002'::uuid);
end;
$$;
