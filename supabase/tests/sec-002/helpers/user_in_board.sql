-- test_id: SEC-002.T-H-user_in_board-owner
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_board-owner', public.user_in_board(:U1::uuid, :B1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_board-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_board-member', public.user_in_board(:U1::uuid, :B1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_board-via-obra
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_board-via-obra', public.user_in_board(:U1::uuid, :B1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_board-outsider
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_board-outsider', public.user_in_board(:U2::uuid, :B1::uuid), false);
rollback;