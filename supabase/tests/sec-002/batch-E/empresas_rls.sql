-- SEC-002 · batch-E · empresas RLS
-- DRI: Cappucceno (GM) / Lovable · ref: R144 · spec: R143

-- test_id: SEC-002.E-empresas-select-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.E-empresas-select-member',
  public.user_in_empresa(:U1::uuid, :E1::uuid), true);
rollback;

-- test_id: SEC-002.E-empresas-select-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.E-empresas-select-outsider-deny',
  public.user_in_empresa(:U2::uuid, :E1::uuid), false);
rollback;

-- test_id: SEC-002.E-empresas-update-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_raises('SEC-002.E-empresas-update-outsider-deny',
  $$update public.empresas set nome = 'z' where id = :E1::uuid$$);
rollback;
