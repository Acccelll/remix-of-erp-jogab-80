-- =========================================================================
-- Kanban — integridade referencial, constraints, índices e Realtime
--
-- Consolida as partes de schema das migrations do remix Lovable. Fica de fora
-- do original o bloco `DELETE FROM cards WHERE titulo = 'teste'`: limpeza de
-- dados de teste não pertence a uma migration versionada.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Foreign keys que faltavam
-- -------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_obra_id_fkey') then
    alter table public.cards
      add constraint cards_obra_id_fkey foreign key (obra_id)
      references public.obras(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cards_criado_por_fkey') then
    alter table public.cards
      add constraint cards_criado_por_fkey foreign key (criado_por)
      references public.profiles(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cards_responsavel_id_fkey') then
    alter table public.cards
      add constraint cards_responsavel_id_fkey foreign key (responsavel_id)
      references public.profiles(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'boards_obra_id_fkey') then
    alter table public.boards
      add constraint boards_obra_id_fkey foreign key (obra_id)
      references public.obras(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'board_membros_user_id_fkey') then
    alter table public.board_membros
      add constraint board_membros_user_id_fkey foreign key (user_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'card_membros_user_id_fkey') then
    alter table public.card_membros
      add constraint card_membros_user_id_fkey foreign key (user_id)
      references public.profiles(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'card_campos_valores_campo_id_fkey') then
    alter table public.card_campos_valores
      add constraint card_campos_valores_campo_id_fkey foreign key (campo_id)
      references public.board_campos(id) on delete cascade;
  end if;
end $$;

-- -------------------------------------------------------------------------
-- Integridade lista × quadro: uma posição de card não pode apontar para uma
-- lista de outro board. Exige chave composta em board_listas.
-- -------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'board_listas_id_board_uk') then
    alter table public.board_listas
      add constraint board_listas_id_board_uk unique (id, board_id);
  end if;
end $$;

alter table public.card_board_posicao
  drop constraint if exists card_board_posicao_lista_fk;
alter table public.card_board_posicao
  add constraint card_board_posicao_lista_fk
  foreign key (lista_id, board_id)
  references public.board_listas(id, board_id) on delete cascade;

-- -------------------------------------------------------------------------
-- CHECK constraints de domínio
-- -------------------------------------------------------------------------
alter table public.board_listas drop constraint if exists board_listas_wip_check;
alter table public.board_listas
  add constraint board_listas_wip_check check (wip_limite is null or wip_limite >= 0);

alter table public.board_membros drop constraint if exists board_membros_papel_check;
alter table public.board_membros
  add constraint board_membros_papel_check check (papel in ('admin', 'membro', 'observador'));

-- -------------------------------------------------------------------------
-- Índices
-- -------------------------------------------------------------------------
drop index if exists public.idx_board_listas_board_pos;
create index if not exists idx_card_recursos_card_id on public.card_recursos(card_id);
create index if not exists idx_card_label_links_label_id on public.card_label_links(label_id);
create index if not exists idx_cards_obra_id on public.cards(obra_id) where obra_id is not null;
create index if not exists idx_cards_responsavel_id on public.cards(responsavel_id) where responsavel_id is not null;
create index if not exists idx_board_membros_user_id on public.board_membros(user_id);

-- -------------------------------------------------------------------------
-- Realtime — o board escuta card_board_posicao e board_listas
-- (src/lib/repositories/boards.ts · subscribeBoard)
-- -------------------------------------------------------------------------
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array['card_board_posicao', 'board_listas'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;

alter table public.card_board_posicao replica identity full;
alter table public.board_listas replica identity full;
