-- SEC-002 · batch-D · obras RLS
-- DRI: Cappucceno (GM) / Lovable · ref: R144 · spec: R143

-- test_id: SEC-002.D-obras-select-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.D-obras-select-member',
  public.user_in_obra(:U1::uuid, :O1::uuid), true);
rollback;

-- test_id: SEC-002.D-obras-select-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.D-obras-select-outsider-deny',
  public.user_in_obra(:U2::uuid, :O1::uuid), false);
rollback;

-- test_id: SEC-002.D-obras-insert-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_raises('SEC-002.D-obras-insert-outsider-deny',
  $$insert into public.obras(id, empresa_id, nome) values (gen_random_uuid(), :E1::uuid, 'x')$$);
rollback;
