-- SEC-002.helpers-02.apply-01 — Candidate migration (NOT auto-applied)
-- Contract: SEC-002.helpers-02.spec-01 §§3–6
-- Target path at deploy PR: supabase/migrations/<yyyymmddhhmmss>_sec_002_helpers_02.sql
-- Invariants: AP1–AP12 (see SEC-002.helpers-02.apply-01.spec-01.md)

begin;

-- 3.1 Funções (create or replace) — ordem topológica §I-H6
create or replace function public.user_in_empresa(_user uuid, _empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_gm()
      or exists (
        select 1
        from public.user_empresas ue
        where ue.user_id = _user
          and ue.empresa_id = _empresa
      );
$$;

create or replace function public.user_in_obra(_user uuid, _obra uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_gm()
      or exists (
        select 1
        from public.obra_membros om
        where om.user_id = _user
          and om.obra_id  = _obra
      );
$$;

create or replace function public.user_in_board(_user uuid, _board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_gm()
      or exists (
        select 1
        from public.board_membros bm
        where bm.board_id = _board
          and bm.user_id  = _user
      );
$$;

create or replace function public.user_in_card(_user uuid, _card uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_is_gm()
      or exists (
        select 1
        from public.card_membros cm
        where cm.card_id = _card
          and cm.user_id = _user
      )
      or exists (
        select 1
        from public.card_board_posicao p
        join public.board_membros bm on bm.board_id = p.board_id
        where p.card_id  = _card
          and bm.user_id = _user
      );
$$;

-- 3.2 Grants (idempotentes) — nenhum ao anon, nenhum ao public
revoke all on function public.user_in_empresa(uuid, uuid) from public, anon;
grant execute on function public.user_in_empresa(uuid, uuid) to authenticated, service_role;

revoke all on function public.user_in_obra(uuid, uuid) from public, anon;
grant execute on function public.user_in_obra(uuid, uuid) to authenticated, service_role;

revoke all on function public.user_in_board(uuid, uuid) from public, anon;
grant execute on function public.user_in_board(uuid, uuid) to authenticated, service_role;

revoke all on function public.user_in_card(uuid, uuid) from public, anon;
grant execute on function public.user_in_card(uuid, uuid) to authenticated, service_role;

-- 3.3 Índices de suporte
create index if not exists idx_user_empresas_user_empresa
  on public.user_empresas(user_id, empresa_id);
create index if not exists idx_obra_membros_user_obra
  on public.obra_membros(user_id, obra_id);
create index if not exists idx_board_membros_board_user
  on public.board_membros(board_id, user_id);
create index if not exists idx_card_membros_card_user
  on public.card_membros(card_id, user_id);
create index if not exists idx_card_board_posicao_card_board
  on public.card_board_posicao(card_id, board_id);

-- 3.4 Comentários (documentação inline)
comment on function public.user_in_empresa(uuid, uuid) is
  'SEC-002.helpers-01 §4.1 — true se _user pertence a _empresa ou é GM';
comment on function public.user_in_obra(uuid, uuid) is
  'SEC-002.helpers-01 §4.2 — true se _user pertence a _obra ou é GM';
comment on function public.user_in_board(uuid, uuid) is
  'SEC-002.helpers-01 §4.3 — true se _user pertence a _board ou é GM';
comment on function public.user_in_card(uuid, uuid) is
  'SEC-002.helpers-01 §4.4 — true se _user pertence a _card (direto ou via board) ou é GM';

commit;
