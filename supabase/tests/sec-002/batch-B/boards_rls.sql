-- SEC-002 · batch-B · boards RLS
-- DRI: Cappucceno (GM) / Lovable · ref: R144 · spec: R143
-- No DDL. begin/rollback. Uses _lib + helpers only.

-- test_id: SEC-002.B-boards-select-owner
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.B-boards-select-owner',
  exists(select 1 from public.boards where id = :B1::uuid), true);
rollback;

-- test_id: SEC-002.B-boards-select-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.B-boards-select-member',
  public.user_in_board(:U1::uuid, :B1::uuid), true);
rollback;

-- test_id: SEC-002.B-boards-select-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.B-boards-select-outsider-deny',
  exists(select 1 from public.boards where id = :B1::uuid), false);
rollback;

-- test_id: SEC-002.B-boards-insert-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_raises('SEC-002.B-boards-insert-outsider-deny',
  $$insert into public.boards(id, obra_id, name) values (gen_random_uuid(), :O1::uuid, 'x')$$);
rollback;
