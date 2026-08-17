-- SEC-002 · batch-C · cards RLS
-- DRI: Cappucceno (GM) / Lovable · ref: R144 · spec: R143

-- test_id: SEC-002.C-cards-select-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.C-cards-select-member',
  public.user_in_card(:U1::uuid, :C1::uuid), true);
rollback;

-- test_id: SEC-002.C-cards-update-member
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U1::uuid);
select pg_temp.assert_bool('SEC-002.C-cards-update-member',
  exists(select 1 from public.cards where id = :C1::uuid), true);
rollback;

-- test_id: SEC-002.C-cards-select-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_bool('SEC-002.C-cards-select-outsider-deny',
  public.user_in_card(:U2::uuid, :C1::uuid), false);
rollback;

-- test_id: SEC-002.C-cards-delete-outsider-deny
begin;
\i _lib/fixtures.sql
\i _lib/jwt.sql
\i _lib/assert.sql
select pg_temp.set_jwt_user(:U2::uuid);
select pg_temp.assert_raises('SEC-002.C-cards-delete-outsider-deny',
  $$delete from public.cards where id = :C1::uuid$$);
rollback;
