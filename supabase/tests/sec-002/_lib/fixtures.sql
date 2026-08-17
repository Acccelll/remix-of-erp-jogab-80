-- SEC-002 fixtures determinísticos — UUIDs canônicos de SEC-002.tests-01 §1.4
\set U1 '''11111111-1111-1111-1111-111111111111'''
\set U2 '''22222222-2222-2222-2222-222222222222'''
\set UGM '''99999999-9999-9999-9999-999999999999'''
\set E1 '''aaaaaaa1-0000-0000-0000-000000000001'''
\set E2 '''aaaaaaa2-0000-0000-0000-000000000002'''
\set O1 '''bbbbbbb1-0000-0000-0000-000000000001'''
\set O2 '''bbbbbbb2-0000-0000-0000-000000000002'''
\set B1 '''ccccccc1-0000-0000-0000-000000000001'''
\set B2 '''ccccccc2-0000-0000-0000-000000000002'''
\set C1 '''ddddddd1-0000-0000-0000-000000000001'''

insert into public.profiles(id) values
  (:U1::uuid), (:U2::uuid), (:UGM::uuid)
on conflict do nothing;

insert into public.empresas(id, razao_social, nome_fantasia) values
  (:E1::uuid, 'SEC-002 Fixture Empresa 1', 'SEC-002 E1'),
  (:E2::uuid, 'SEC-002 Fixture Empresa 2', 'SEC-002 E2')
on conflict do nothing;

insert into public.obras(id, nome, cliente, empresa_id) values
  (:O1::uuid, 'SEC-002 Fixture Obra 1', 'SEC-002 Cliente 1', :E1::uuid),
  (:O2::uuid, 'SEC-002 Fixture Obra 2', 'SEC-002 Cliente 2', :E2::uuid)
on conflict do nothing;

insert into public.user_empresas(user_id, empresa_id) values
  (:U1::uuid, :E1::uuid)
on conflict do nothing;

insert into public.obra_membros(user_id, obra_id) values
  (:U1::uuid, :O1::uuid)
on conflict do nothing;

insert into public.boards(id, nome, owner_id, obra_id) values
  (:B1::uuid, 'SEC-002 Fixture Board 1', :U1::uuid, :O1::uuid),
  (:B2::uuid, 'SEC-002 Fixture Board 2', :U2::uuid, null)
on conflict do nothing;

insert into public.board_membros(board_id, user_id) values
  (:B1::uuid, :U1::uuid)
on conflict do nothing;

insert into public.cards(id, titulo, obra_id, responsavel_id) values
  (:C1::uuid, 'SEC-002 Fixture Card 1', :O1::uuid, :U1::uuid)
on conflict do nothing;

insert into public.card_membros(card_id, user_id) values
  (:C1::uuid, :U1::uuid)
on conflict do nothing;

insert into public.card_board_posicao(card_id, board_id) values
  (:C1::uuid, :B1::uuid)
on conflict do nothing;

insert into public.user_roles(user_id, role) values
  (:UGM::uuid, 'gm')
on conflict do nothing;
-- ============================================================================
-- SEC-002.tests-02.fixtures-01.materialize-01 (R192b) — apêndice canônico.
-- Prefixo (linhas 1-57) preservado byte-a-byte. Aditivo, idempotente.
-- Contrato: SEC-002.tests-02.fixtures-01.spec-01 (R192).
-- ============================================================================
\set U_OBR1 '''44444441-0000-0000-0000-000000000001'''
\set U_BRD1 '''44444442-0000-0000-0000-000000000002'''
\set U_CRD1 '''44444443-0000-0000-0000-000000000003'''
\set U_DP   '''55555555-0000-0000-0000-000000000001'''
\set U_FIN  '''55555555-0000-0000-0000-000000000002'''
\set U_OUT  '''66666666-0000-0000-0000-000000000001'''
\set C2     '''ddddddd2-0000-0000-0000-000000000002'''
\set SF1    '''eeeeeee1-0000-0000-0000-000000000001'''

insert into public.profiles(id) values
  (:U_OBR1::uuid), (:U_BRD1::uuid), (:U_CRD1::uuid),
  (:U_DP::uuid),   (:U_FIN::uuid),  (:U_OUT::uuid)
on conflict do nothing;

insert into public.obra_membros(user_id, obra_id) values
  (:U_OBR1::uuid, :O1::uuid)
on conflict do nothing;

insert into public.board_membros(board_id, user_id) values
  (:B1::uuid, :U_BRD1::uuid)
on conflict do nothing;

insert into public.cards(id, titulo, obra_id, responsavel_id) values
  (:C2::uuid, 'SEC-002 Fixture Card 2', null, :U2::uuid)
on conflict do nothing;

insert into public.card_board_posicao(card_id, board_id) values
  (:C2::uuid, :B2::uuid)
on conflict do nothing;

insert into public.card_membros(card_id, user_id) values
  (:C1::uuid, :U_CRD1::uuid)
on conflict do nothing;

-- user_setores: comentado enquanto D-3 estiver pendente (tabela pode não existir).
-- Descomentar em R+? após D-3 assinada.
-- insert into public.user_setores(user_id, setor) values
--   (:U_DP::uuid,  'dp'),
--   (:U_FIN::uuid, 'financeiro')
-- on conflict do nothing;

-- solicitacoes_financeiras: fixture para caso segregation.
-- Só executa se a tabela existir com as colunas esperadas.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='solicitacoes_financeiras'
      and column_name='solicitante_id'
  ) then
    execute format(
      'insert into public.solicitacoes_financeiras(id, solicitante_id, obra_id, valor) values (%L::uuid, %L::uuid, %L::uuid, 100.00) on conflict do nothing',
      'eeeeeee1-0000-0000-0000-000000000001',
      '11111111-1111-1111-1111-111111111111',
      'bbbbbbb1-0000-0000-0000-000000000001'
    );
  end if;
end$$;
