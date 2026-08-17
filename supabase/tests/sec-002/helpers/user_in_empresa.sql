-- test_id: SEC-002.T-H-user_in_empresa-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_empresa-member', public.user_in_empresa(:U1::uuid, :E1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_empresa-outsider
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_empresa-outsider', public.user_in_empresa(:U2::uuid, :E1::uuid), false);
rollback;

-- test_id: SEC-002.T-H-user_in_empresa-gm
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:UGM::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_empresa-gm', public.user_in_empresa(:UGM::uuid, :E1::uuid), true);
rollback;