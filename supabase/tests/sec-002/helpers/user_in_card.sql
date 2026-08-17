-- test_id: SEC-002.T-H-user_in_card-responsavel
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_card-responsavel', public.user_in_card(:U1::uuid, :C1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_card-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_card-member', public.user_in_card(:U1::uuid, :C1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_card-via-board
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_card-via-board', public.user_in_card(:U1::uuid, :C1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_card-via-obra
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_card-via-obra', public.user_in_card(:U1::uuid, :C1::uuid), true);
rollback;

-- test_id: SEC-002.T-H-user_in_card-outsider
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.T-H-user_in_card-outsider', public.user_in_card(:U2::uuid, :C1::uuid), false);
rollback;