-- =========================================================================
-- Logística de Ativos & Frotas — Romaneios
--
-- Romaneio é o documento que orquestra: baixa de estoque interno (Postgres,
-- transacional via fn_estoque_transferir) + mobilização de Patrimônio/Veículo
-- (MySQL legado, via api.php — fora desta transação, orquestrada pelo client
-- em src/hooks/logisticaAtivos/useConfirmarRomaneio.ts).
--
-- Entidade nova, sem equivalente no MySQL legado: nasce 100% em Postgres.
-- veiculo_transportador_id / patrimonio_id seguem a convenção DB-001 de "id
-- legado dentro de tabela Postgres" (text + CHECK db001_legacy_id_is_valid,
-- nunca FK real contra as tabelas espelho public.veiculos/public.patrimonios).
-- obra_origem_id / obra_destino_id usam FK real contra public.obras, que já
-- é a chave compartilhada de fato entre MySQL e Postgres para obra.
-- =========================================================================

create table if not exists public.romaneios (
  id uuid primary key default gen_random_uuid(),
  numero text not null,
  status text not null default 'rascunho'
    check (status in (
      'rascunho',
      'estoque_baixado',
      'confirmado',
      'confirmado_parcial',
      'falha_estoque',
      'cancelado'
    )),
  obra_origem_id uuid references public.obras(id) on delete restrict,
  obra_destino_id uuid not null references public.obras(id) on delete restrict,
  veiculo_transportador_id text,
  mobilizar_veiculo boolean not null default false,
  veiculo_mobilizado_em timestamptz,
  veiculo_mobilizacao_erro text,
  data_programada date,
  observacao text,
  owner_id uuid default auth.uid(),
  criado_por_nome text,
  confirmado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint romaneios_veiculo_transportador_id_fmt
    check (veiculo_transportador_id is null or public.db001_legacy_id_is_valid(veiculo_transportador_id))
);
create index if not exists idx_romaneios_status on public.romaneios(status);
create index if not exists idx_romaneios_obra_destino on public.romaneios(obra_destino_id);
create index if not exists idx_romaneios_obra_origem on public.romaneios(obra_origem_id);
create unique index if not exists uq_romaneios_numero on public.romaneios(numero);

create table if not exists public.romaneio_itens_estoque (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null references public.romaneios(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  quantidade numeric(14,4) not null check (quantidade > 0),
  local_origem text not null,
  local_destino text not null,
  baixado boolean not null default false,
  baixado_em timestamptz,
  observacao text,
  created_at timestamptz not null default now(),
  constraint romaneio_itens_estoque_origem_destino_diff check (local_origem <> local_destino)
);
create index if not exists idx_rie_romaneio on public.romaneio_itens_estoque(romaneio_id);

create table if not exists public.romaneio_itens_patrimonio (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null references public.romaneios(id) on delete cascade,
  patrimonio_id text not null,
  patrimonio_codigo text,
  patrimonio_nome text,
  mobilizado boolean not null default false,
  mobilizado_em timestamptz,
  mobilizacao_erro text,
  created_at timestamptz not null default now(),
  constraint romaneio_itens_patrimonio_patrimonio_id_fmt
    check (public.db001_legacy_id_is_valid(patrimonio_id))
);
create index if not exists idx_rip_romaneio on public.romaneio_itens_patrimonio(romaneio_id);
create unique index if not exists uq_rip_romaneio_patrimonio
  on public.romaneio_itens_patrimonio(romaneio_id, patrimonio_id);

-- updated_at trigger (mesmo padrão de touch_updated_at usado em Suprimentos) -
drop trigger if exists trg_romaneios_updated_at on public.romaneios;
create trigger trg_romaneios_updated_at
before update on public.romaneios
for each row execute function public.touch_updated_at();

-- =========================================================================
-- GRANTs e RLS — mesmo padrão do Grupo B de Suprimentos: leitura company-wide
-- autenticada; escrita por GM ou setor Compras/Engenharia (Romaneio escreve
-- estoque — domínio Compras — e orquestra Patrimônio/Frotas — setor legado
-- mapeado para Engenharia).
-- =========================================================================
do $$
declare t text;
begin
  foreach t in array array['romaneios','romaneio_itens_estoque','romaneio_itens_patrimonio'] loop
    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
    execute format('grant all on public.%I to service_role;', t);
    execute format('alter table public.%I enable row level security;', t);

    execute format($p$
      create policy "%1$s read" on public.%1$I
      for select to authenticated using (true);
    $p$, t);

    execute format($p$
      create policy "%1$s write" on public.%1$I
      for all to authenticated
      using (
        public.current_is_gm()
        or public.current_has_setor('Compras')
        or public.current_has_setor('Engenharia')
      )
      with check (
        public.current_is_gm()
        or public.current_has_setor('Compras')
        or public.current_has_setor('Engenharia')
      );
    $p$, t);
  end loop;
end $$;

-- =========================================================================
-- RPC: baixa atômica de todos os itens de estoque de um romaneio.
--
-- Reusa fn_estoque_transferir (já audita permissão de setor/obra e valida
-- saldo com FOR UPDATE) item a item, dentro de UMA transação — se qualquer
-- item falhar (saldo insuficiente, permissão), a função inteira faz ROLLBACK
-- e o romaneio permanece em 'rascunho'/'falha_estoque'. Esta é a única perna
-- do fluxo de confirmação que pode ser atômica de verdade (tudo Postgres); a
-- perna MySQL (mobilização de patrimônio/veículo) é orquestrada à parte pelo
-- client, depois desta função ter retornado sucesso — ver
-- src/hooks/logisticaAtivos/useConfirmarRomaneio.ts.
-- =========================================================================
create or replace function public.fn_romaneio_confirmar_estoque(p_romaneio_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_total integer := 0;
begin
  if not (
    public.current_is_gm()
    or public.current_has_setor('Compras')
    or public.current_has_setor('Engenharia')
  ) then
    raise exception 'Sem permissão para confirmar romaneio';
  end if;

  if not exists (
    select 1 from public.romaneios where id = p_romaneio_id and status = 'rascunho'
  ) then
    raise exception 'Romaneio não está em rascunho ou não existe';
  end if;

  for r in
    select * from public.romaneio_itens_estoque
    where romaneio_id = p_romaneio_id and not baixado
  loop
    perform public.fn_estoque_transferir(
      r.insumo_id, r.local_origem, r.local_destino, r.quantidade,
      'romaneio:' || p_romaneio_id::text
    );
    update public.romaneio_itens_estoque
      set baixado = true, baixado_em = now()
      where id = r.id;
    v_total := v_total + 1;
  end loop;

  update public.romaneios set status = 'estoque_baixado' where id = p_romaneio_id;
  return jsonb_build_object('ok', true, 'itens_baixados', v_total);
exception when others then
  update public.romaneios set status = 'falha_estoque' where id = p_romaneio_id;
  raise;
end;
$function$;

revoke all on function public.fn_romaneio_confirmar_estoque(uuid) from public, anon;
grant execute on function public.fn_romaneio_confirmar_estoque(uuid) to authenticated, service_role;
