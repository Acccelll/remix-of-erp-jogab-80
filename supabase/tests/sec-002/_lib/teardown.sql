-- SEC-002.tests-02.teardown-01.materialize-01 (R196')
-- Teardown idempotente das fixtures transitórias da suíte SEC-002.
-- Mantém fixtures base R132; remove apenas complementos R192b e papel gm transitório.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'solicitacoes_financeiras'
      and column_name = 'id'
  ) then
    execute 'delete from public.solicitacoes_financeiras where id = ''eeeeeee1-0000-0000-0000-000000000001''::uuid';
  end if;
end$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_setores'
  ) then
    execute 'delete from public.user_setores where user_id in (''55555555-0000-0000-0000-000000000001''::uuid, ''55555555-0000-0000-0000-000000000002''::uuid)';
  end if;
end$$;

delete from public.card_membros
where (card_id = 'ddddddd1-0000-0000-0000-000000000001'::uuid
       and user_id = '44444443-0000-0000-0000-000000000003'::uuid)
   or card_id = 'ddddddd2-0000-0000-0000-000000000002'::uuid;

delete from public.card_board_posicao
where card_id = 'ddddddd2-0000-0000-0000-000000000002'::uuid;

delete from public.cards
where id = 'ddddddd2-0000-0000-0000-000000000002'::uuid;

delete from public.board_membros
where board_id = 'ccccccc1-0000-0000-0000-000000000001'::uuid
  and user_id = '44444442-0000-0000-0000-000000000002'::uuid;

delete from public.obra_membros
where user_id = '44444441-0000-0000-0000-000000000001'::uuid
  and obra_id = 'bbbbbbb1-0000-0000-0000-000000000001'::uuid;

delete from public.user_roles
where user_id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '99999999-9999-9999-9999-999999999999'::uuid
)
and role = 'gm';

delete from public.profiles
where id in (
  '44444441-0000-0000-0000-000000000001'::uuid,
  '44444442-0000-0000-0000-000000000002'::uuid,
  '44444443-0000-0000-0000-000000000003'::uuid,
  '55555555-0000-0000-0000-000000000001'::uuid,
  '55555555-0000-0000-0000-000000000002'::uuid,
  '66666666-0000-0000-0000-000000000001'::uuid
);