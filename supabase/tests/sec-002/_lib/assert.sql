-- SEC-002 assert macros sem extensões externas.
create or replace function pg_temp.assert_bool(_test_id text, _actual boolean, _expected boolean)
returns void
language plpgsql
as $$
begin
  if _actual is distinct from _expected then
    raise exception '% failed: got % expected %', _test_id, _actual, _expected;
  end if;
  raise notice '-- OK: %', _test_id;
end;
$$;

create or replace function pg_temp.assert_rows(_test_id text, _actual bigint, _expected bigint)
returns void
language plpgsql
as $$
begin
  if _actual <> _expected then
    raise exception '% failed: got % expected %', _test_id, _actual, _expected;
  end if;
  raise notice '-- OK: %', _test_id;
end;
$$;

create or replace function pg_temp.assert_denied(_test_id text, _sql text)
returns void
language plpgsql
as $$
begin
  begin
    execute _sql;
  exception when insufficient_privilege then
    raise notice '-- OK: %', _test_id;
    return;
  end;
  raise exception '% failed: command was not denied', _test_id;
end;
$$;
-- ============================================================================
-- SEC-002.tests-02.assert-01.materialize-01 (R190) — helpers pgTAP para RLS.
-- Contrato: SEC-002.tests-02.assert-01.spec-01 (R186).
-- Não usa security definer, não altera role/search_path/JWT, sem DDL fora de
-- create or replace function pg_temp.*. Oráculo: pass()/fail() do pgTAP.
-- ============================================================================

create or replace function pg_temp.assert_rls_select(_test_id text, _sql text, _expect text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute format('select count(*) from (%s) q', _sql) into v_count;
  if _expect = 'allow' and v_count > 0 then
    perform pass(_test_id || ' select allow');
  elsif _expect = 'empty' and v_count = 0 then
    perform pass(_test_id || ' select empty');
  elsif _expect = 'deny' and v_count = 0 then
    perform pass(_test_id || ' select deny-empty');
  else
    perform fail(_test_id || ' select expected ' || _expect || ' got count=' || v_count);
  end if;
exception when insufficient_privilege then
  if _expect = 'deny' then
    perform pass(_test_id || ' select deny-error');
  else
    perform fail(_test_id || ' select unexpected permission error');
  end if;
end;
$$;

create or replace function pg_temp.assert_rls_insert(_test_id text, _sql text, _expect text)
returns void
language plpgsql
as $$
declare
  v_rows bigint;
begin
  if _expect = 'empty' then
    perform fail(_test_id || ' insert E_ASSERT_EXPECT_INVALID (empty not allowed for insert)');
    return;
  end if;
  execute _sql;
  get diagnostics v_rows = row_count;
  if _expect = 'allow' and v_rows > 0 then
    perform pass(_test_id || ' insert allow');
  elsif _expect = 'deny' and v_rows = 0 then
    perform pass(_test_id || ' insert deny-filtered');
  else
    perform fail(_test_id || ' insert expected ' || _expect || ' got rows=' || v_rows);
  end if;
exception when insufficient_privilege or check_violation then
  if _expect = 'deny' then
    perform pass(_test_id || ' insert deny-error');
  else
    perform fail(_test_id || ' insert unexpected denial');
  end if;
end;
$$;

create or replace function pg_temp.assert_rls_update(_test_id text, _sql text, _expect text)
returns void
language plpgsql
as $$
declare
  v_rows bigint;
begin
  if _expect = 'empty' then
    perform fail(_test_id || ' update E_ASSERT_EXPECT_INVALID (empty not allowed for update)');
    return;
  end if;
  execute _sql;
  get diagnostics v_rows = row_count;
  if _expect = 'allow' and v_rows > 0 then
    perform pass(_test_id || ' update allow');
  elsif _expect = 'deny' and v_rows = 0 then
    perform pass(_test_id || ' update deny-filtered');
  else
    perform fail(_test_id || ' update expected ' || _expect || ' got rows=' || v_rows);
  end if;
exception when insufficient_privilege or check_violation then
  if _expect = 'deny' then
    perform pass(_test_id || ' update deny-error');
  else
    perform fail(_test_id || ' update unexpected denial');
  end if;
end;
$$;

create or replace function pg_temp.assert_rls_delete(_test_id text, _sql text, _expect text)
returns void
language plpgsql
as $$
declare
  v_rows bigint;
begin
  if _expect = 'empty' then
    perform fail(_test_id || ' delete E_ASSERT_EXPECT_INVALID (empty not allowed for delete)');
    return;
  end if;
  execute _sql;
  get diagnostics v_rows = row_count;
  if _expect = 'allow' and v_rows > 0 then
    perform pass(_test_id || ' delete allow');
  elsif _expect = 'deny' and v_rows = 0 then
    perform pass(_test_id || ' delete deny-filtered');
  else
    perform fail(_test_id || ' delete expected ' || _expect || ' got rows=' || v_rows);
  end if;
exception when insufficient_privilege or check_violation then
  if _expect = 'deny' then
    perform pass(_test_id || ' delete deny-error');
  else
    perform fail(_test_id || ' delete unexpected denial');
  end if;
end;
$$;
