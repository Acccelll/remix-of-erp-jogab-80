-- =========================================================================
-- Kanban — RLS de cards/boards e permissões
--
-- Consolida as políticas que vieram do remix Lovable. Duas correções
-- deliberadas em relação ao original:
--
--   1. O original continha
--          GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
--          GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
--      que desfazia a migration 20260701172109 (revogação de EXECUTE em todas
--      as funções SECURITY DEFINER fora de uma whitelist) e abria escrita em
--      todas as tabelas do schema. Aqui os GRANTs são por tabela.
--
--   2. O original criava políticas SELECT/UPDATE/DELETE em `cards` mas nenhuma
--      de INSERT, o que deixaria a tabela sem caminho de inserção direta.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Funções de autorização
-- -------------------------------------------------------------------------
create or replace function public.pode_admin_board(_board_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select exists (
    select 1 from public.board_membros
    where board_id = _board_id and user_id = _user_id and papel = 'admin'
  ) or exists (
    select 1 from public.boards
    where id = _board_id and owner_id = _user_id
  ) or private.is_current_player_gm();
$function$;

create or replace function public.card_pode_ver(p_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select private.is_current_player_gm()
      or exists (
        select 1 from public.card_board_posicao cbp
        where cbp.card_id = p_card_id
          and private.pode_ver_board(cbp.board_id, auth.uid())
      );
$function$;

create or replace function public.card_pode_editar(p_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select private.is_current_player_gm()
      or exists (
        select 1 from public.card_board_posicao cbp
        where cbp.card_id = p_card_id
          and public.pode_admin_board(cbp.board_id, auth.uid())
      )
      or exists (
        select 1 from public.card_board_posicao cbp
        join public.board_membros bm on bm.board_id = cbp.board_id
        where cbp.card_id = p_card_id
          and bm.user_id = auth.uid()
          and bm.papel in ('admin', 'membro')
      );
$function$;

revoke all on function public.pode_admin_board(uuid, uuid) from public, anon;
revoke all on function public.card_pode_ver(uuid) from public, anon;
revoke all on function public.card_pode_editar(uuid) from public, anon;
grant execute on function public.pode_admin_board(uuid, uuid) to authenticated, service_role;
grant execute on function public.card_pode_ver(uuid) to authenticated, service_role;
grant execute on function public.card_pode_editar(uuid) to authenticated, service_role;

-- -------------------------------------------------------------------------
-- RLS em `cards`
-- -------------------------------------------------------------------------
alter table public.cards enable row level security;
drop policy if exists "auth read cards" on public.cards;
drop policy if exists "auth write cards" on public.cards;
drop policy if exists cards_select on public.cards;
drop policy if exists cards_insert on public.cards;
drop policy if exists cards_update on public.cards;
drop policy if exists cards_delete on public.cards;

create policy cards_select on public.cards
  for select to authenticated using (public.card_pode_ver(id));

-- INSERT: o card nasce sem posição em board, então não há board para checar.
-- Autoria própria é o critério; o vínculo com o quadro é criado logo em
-- seguida por card_board_posicao, que tem política própria.
create policy cards_insert on public.cards
  for insert to authenticated with check (criado_por = auth.uid() or private.is_current_player_gm());

create policy cards_update on public.cards
  for update to authenticated using (public.card_pode_editar(id)) with check (public.card_pode_editar(id));

create policy cards_delete on public.cards
  for delete to authenticated using (public.card_pode_editar(id));

-- -------------------------------------------------------------------------
-- RLS nas tabelas filhas que têm card_id
-- -------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'card_setores', 'card_recursos', 'card_membros',
    'card_label_links', 'card_checklist_itens', 'card_comentarios',
    'card_atividades', 'card_anexos', 'card_local', 'card_secoes_visiveis',
    'card_campos_valores', 'card_custom_field_valores'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "auth read %s" on public.%I', t, t);
    execute format('drop policy if exists "auth write %s" on public.%I', t, t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.card_pode_ver(card_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.card_pode_editar(card_id)) with check (public.card_pode_editar(card_id))',
      t || '_write', t);
  end loop;
end $$;

-- card_views_salvas não tem card_id: regra própria (dono da view).
alter table public.card_views_salvas enable row level security;
drop policy if exists card_views_salvas_select on public.card_views_salvas;
drop policy if exists card_views_salvas_write on public.card_views_salvas;
create policy card_views_salvas_select on public.card_views_salvas
  for select to authenticated using (true);
create policy card_views_salvas_write on public.card_views_salvas
  for all to authenticated using (criado_por = auth.uid()) with check (criado_por = auth.uid());

-- -------------------------------------------------------------------------
-- RLS em `boards`
-- -------------------------------------------------------------------------
drop policy if exists "boards_select" on public.boards;
create policy "boards_select" on public.boards
  for select to authenticated
  using (
    visibilidade in ('empresa', 'setor')
    or owner_id = auth.uid()
    or private.pode_ver_board(id, auth.uid())
  );

drop policy if exists "boards_update" on public.boards;
create policy "boards_update" on public.boards
  for update to authenticated
  using (public.pode_admin_board(id, auth.uid()))
  with check (public.pode_admin_board(id, auth.uid()));

-- -------------------------------------------------------------------------
-- Aditivos de contrato — exclusão permitida em rascunho/cancelado
-- (suporta o botão de excluir aditivo em src/components/obra/AditivosTab.tsx)
-- -------------------------------------------------------------------------
alter table public.aditivos_contrato enable row level security;
drop policy if exists "Aditivos delete se rascunho" on public.aditivos_contrato;
create policy "Aditivos delete se rascunho" on public.aditivos_contrato
  for delete to authenticated
  using (status in ('rascunho', 'cancelado'));

-- -------------------------------------------------------------------------
-- GRANTs explícitos por tabela (substituem o GRANT ALL ON ALL TABLES do
-- original). RLS continua sendo o gate real; o grant só abre a porta.
-- -------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'cards', 'card_board_posicao', 'board_listas', 'boards', 'board_membros',
    'card_setores', 'card_recursos', 'card_membros', 'card_labels',
    'card_label_links', 'card_checklist_itens', 'card_comentarios',
    'card_atividades', 'card_anexos', 'card_local', 'card_secoes_visiveis',
    'card_campos_valores', 'card_custom_field_valores', 'card_views_salvas',
    'aditivos_contrato'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      continue;
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on sequence public.cards_numero_seq to authenticated;
