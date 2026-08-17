-- test_id: SEC-002.T-H-user_in_obra-direct
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_obra-direct', public.user_in_obra(:U1::uuid, :O1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_obra-via-empresa
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_obra-via-empresa', public.user_in_obra(:U1::uuid, :O1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_obra-outsider
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_obra-outsider', public.user_in_obra(:U2::uuid, :O1::uuid), false);
rollback;