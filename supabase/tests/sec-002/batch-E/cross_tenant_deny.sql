-- SEC-002 · batch-E · cross-tenant deny
-- DRI: Cappucceno (GM) / Lovable · ref: R144 · spec: R143
-- Two JWTs via jwt.sign_as(user_id); each cross-tenant read/write must fail.

-- test_id: SEC-002.E-cross-boards-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.E-cross-boards-deny',
  exists(select 1 from public.boards where id = :B1::uuid), false);
rollback;

-- test_id: SEC-002.E-cross-cards-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.E-cross-cards-deny',
  exists(select 1 from public.cards where id = :C1::uuid), false);
rollback;

-- test_id: SEC-002.E-cross-obras-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.E-cross-obras-deny',
  exists(select 1 from public.obras where id = :O1::uuid), false);
rollback;

-- test_id: SEC-002.E-cross-empresas-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.E-cross-empresas-deny',
  exists(select 1 from public.empresas where id = :E1::uuid), false);
rollback;
