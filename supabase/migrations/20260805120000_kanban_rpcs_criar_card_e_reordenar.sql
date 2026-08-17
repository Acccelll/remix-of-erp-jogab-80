-- =========================================================================
-- Kanban — RPCs de criação e reordenação de cards
--
-- Consolida o trabalho que veio do remix Lovable (ondas 1-6), que no original
-- estava espalhado em ~12 migrations recriando a mesma função enquanto se
-- depurava permissão. Aqui fica só o estado final.
--
-- Mudança de contrato relevante: `criar_card_board_atomico` passa a retornar
-- TABLE(card_id, numero) em vez de `public.cards`. O client
-- (src/lib/repositories/cardsExtra.ts) consome `data[0].card_id`.
--
-- NÃO altera `board_items_resumo` nem `board_atividades_recentes`: as versões
-- vigentes (20260707150224) já são corretas e mais completas que as do remix,
-- que referenciavam uma coluna inexistente `cards.setores` e perdiam os
-- filtros de arquivado.
-- =========================================================================

-- cards.arquivado — guarda idempotente (coluna já existe no schema atual).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cards' and column_name = 'arquivado'
  ) then
    alter table public.cards add column arquivado boolean not null default false;
  end if;
end $$;

-- -------------------------------------------------------------------------
-- criar_card_board_atomico — nova assinatura de retorno.
-- Todas as assinaturas anteriores precisam cair antes: o retorno mudou de
-- `public.cards` para TABLE(...), o que CREATE OR REPLACE não consegue fazer.
-- -------------------------------------------------------------------------
drop function if exists public.criar_card_board_atomico(uuid, uuid, text, text);
drop function if exists public.criar_card_board_atomico(uuid, uuid, text, uuid);
drop function if exists public.criar_card_board_atomico(uuid, uuid, uuid, text);

create or replace function public.criar_card_board_atomico(
  p_board_id uuid,
  p_lista_id uuid,
  p_titulo text,
  p_criado_por text default null
)
returns table(card_id uuid, numero bigint)
language plpgsql
security definer
set search_path = public, private
as $function$
#variable_conflict use_column
declare
  v_board record;
  v_card_id uuid;
  v_numero bigint;
  v_posicao numeric;
  v_titulo text := nullif(btrim(coalesce(p_titulo, '')), '');
  v_actor uuid := auth.uid();
begin
  if v_actor is null and auth.role() <> 'service_role' then
    raise exception 'USUARIO_NAO_AUTENTICADO' using errcode = '28000';
  end if;

  if v_titulo is null then
    raise exception 'TITULO_VAZIO' using errcode = '22023';
  end if;

  select b.id, b.tipo, b.setor, b.obra_id, b.arquivado
    into v_board
  from public.boards b
  where b.id = p_board_id;

  if not found then
    raise exception 'QUADRO_NAO_ENCONTRADO' using errcode = 'P0002';
  end if;

  if coalesce(v_board.arquivado, false) then
    raise exception 'QUADRO_ARQUIVADO' using errcode = 'P0002';
  end if;

  -- Autorização explícita: SECURITY DEFINER contorna RLS, então a permissão
  -- de escrita no quadro tem de ser checada aqui.
  if not private.pode_ver_board(p_board_id, v_actor) and auth.role() <> 'service_role' then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.board_listas bl
    where bl.id = p_lista_id and bl.board_id = p_board_id and bl.arquivada = false
  ) then
    raise exception 'LISTA_INVALIDA' using errcode = 'P0002';
  end if;

  insert into public.cards (tipo, titulo, status, obra_id, criado_por, arquivado)
  values ('generico', v_titulo, 'aberto', v_board.obra_id, v_actor, false)
  returning id, cards.numero into v_card_id, v_numero;

  if v_board.tipo = 'setor' and v_board.setor is not null then
    insert into public.card_setores (card_id, setor)
    values (v_card_id, v_board.setor)
    on conflict (card_id, setor) do nothing;
  end if;

  select coalesce(max(cbp.posicao), 0) + 10 into v_posicao
  from public.card_board_posicao cbp
  where cbp.board_id = p_board_id and cbp.lista_id = p_lista_id;

  insert into public.card_board_posicao (card_id, board_id, lista_id, posicao, arquivada)
  values (v_card_id, p_board_id, p_lista_id, v_posicao, false);

  return query select v_card_id, v_numero;
end;
$function$;

revoke all on function public.criar_card_board_atomico(uuid, uuid, text, text) from public, anon;
grant execute on function public.criar_card_board_atomico(uuid, uuid, text, text) to authenticated, service_role;

-- -------------------------------------------------------------------------
-- board_reordenar — persiste a ordem dos cards dentro de uma lista.
-- -------------------------------------------------------------------------
create or replace function public.board_reordenar(
  p_board_id uuid,
  p_lista_id uuid,
  p_card_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  if not private.pode_ver_board(p_board_id, auth.uid()) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  update public.card_board_posicao cbp
     set posicao = pos.new_pos,
         updated_at = now()
    from (
      select id, row_number() over () * 10 as new_pos
      from unnest(p_card_ids) as id
    ) as pos
   where cbp.card_id = pos.id
     and cbp.board_id = p_board_id
     and cbp.lista_id = p_lista_id;
end;
$function$;

revoke all on function public.board_reordenar(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.board_reordenar(uuid, uuid, uuid[]) to authenticated, service_role;
