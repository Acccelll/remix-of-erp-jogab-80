-- =========================================================================
-- Fase 5A — Suprimentos estruturado
-- Requisicao (do orcamento) -> Cotacao -> OC -> Recebimento -> Estoque
-- =========================================================================

-- 1. Fornecedores -----------------------------------------------------------
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  cnpj text,
  razao_social text not null,
  nome_fantasia text,
  contato text,
  email text,
  telefone text,
  categorias text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fornecedores_razao on public.fornecedores(razao_social);
create index if not exists idx_fornecedores_cnpj on public.fornecedores(cnpj);

-- 2. Requisicoes ------------------------------------------------------------
create table if not exists public.requisicoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  card_recurso_id uuid references public.cards(id) on delete set null,
  orcamento_item_id uuid references public.orcamento_itens(id) on delete set null,
  insumo_id uuid references public.insumos(id) on delete set null,
  quantidade numeric(14,4) not null default 0,
  status text not null default 'aberta',
  observacao text,
  owner_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_requisicoes_obra on public.requisicoes(obra_id);
create index if not exists idx_requisicoes_orcamento on public.requisicoes(orcamento_item_id);
create index if not exists idx_requisicoes_card on public.requisicoes(card_recurso_id);
create index if not exists idx_requisicoes_status on public.requisicoes(status);

-- 3. Cotacoes ---------------------------------------------------------------
create table if not exists public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  requisicao_id uuid not null references public.requisicoes(id) on delete cascade,
  status text not null default 'aberta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cotacoes_requisicao on public.cotacoes(requisicao_id);

create table if not exists public.cotacao_propostas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  preco_unitario numeric(14,4) not null default 0,
  prazo_entrega_dias integer,
  condicao_pagamento text,
  observacao text,
  escolhida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_cotacao_propostas_cotacao on public.cotacao_propostas(cotacao_id);
create index if not exists idx_cotacao_propostas_fornec on public.cotacao_propostas(fornecedor_id);

-- 4. Ordens de Compra -------------------------------------------------------
create table if not exists public.ordens_compra (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedores(id) on delete restrict,
  numero bigint generated always as identity,
  status text not null default 'rascunho',
  status_aprovacao text not null default 'pendente',
  valor_total numeric(14,2) not null default 0,
  emitida_em timestamptz,
  observacao text,
  owner_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_oc_obra on public.ordens_compra(obra_id);
create index if not exists idx_oc_fornec on public.ordens_compra(fornecedor_id);
create index if not exists idx_oc_status on public.ordens_compra(status);

create table if not exists public.ordem_compra_itens (
  id uuid primary key default gen_random_uuid(),
  ordem_compra_id uuid not null references public.ordens_compra(id) on delete cascade,
  requisicao_id uuid references public.requisicoes(id) on delete set null,
  insumo_id uuid references public.insumos(id) on delete set null,
  descricao text not null default '',
  quantidade numeric(14,4) not null default 0,
  preco_unitario numeric(14,4) not null default 0,
  valor_total numeric(14,2) generated always as (round((quantidade * preco_unitario)::numeric, 2)) stored,
  created_at timestamptz not null default now()
);
create index if not exists idx_oc_itens_oc on public.ordem_compra_itens(ordem_compra_id);
create index if not exists idx_oc_itens_req on public.ordem_compra_itens(requisicao_id);

-- 5. Recebimento ------------------------------------------------------------
create table if not exists public.recebimento_materiais (
  id uuid primary key default gen_random_uuid(),
  ordem_compra_id uuid not null references public.ordens_compra(id) on delete cascade,
  nota_fiscal text,
  data_recebimento date not null default current_date,
  observacao text,
  owner_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_recebimento_oc on public.recebimento_materiais(ordem_compra_id);

create table if not exists public.recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  recebimento_id uuid not null references public.recebimento_materiais(id) on delete cascade,
  ordem_compra_item_id uuid references public.ordem_compra_itens(id) on delete set null,
  quantidade_recebida numeric(14,4) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_recebimento_itens_rec on public.recebimento_itens(recebimento_id);
create index if not exists idx_recebimento_itens_oci on public.recebimento_itens(ordem_compra_item_id);

-- 6. Estoque ----------------------------------------------------------------
create table if not exists public.estoque_saldos (
  id uuid primary key default gen_random_uuid(),
  local text not null,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  saldo numeric(14,4) not null default 0,
  minimo numeric(14,4) not null default 0,
  updated_at timestamptz not null default now(),
  unique (local, insumo_id)
);
create index if not exists idx_estoque_saldos_local on public.estoque_saldos(local);
create index if not exists idx_estoque_saldos_insumo on public.estoque_saldos(insumo_id);

create table if not exists public.estoque_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  local text not null,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  tipo text not null,
  quantidade numeric(14,4) not null,
  origem text,
  observacao text,
  owner_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_estoque_mov_local on public.estoque_movimentacoes(local);
create index if not exists idx_estoque_mov_insumo on public.estoque_movimentacoes(insumo_id);

-- updated_at triggers -------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fornecedores','requisicoes','cotacoes','ordens_compra','estoque_saldos'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I;', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I '
      'for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- =========================================================================
-- Trigger: ao emitir OC, preencher card_recursos.valor_oc somando itens
-- ligados a requisicoes->card_recurso_id. Custo comprometido entra no EVM
-- apenas com OC emitida (regra: nunca de valor_estimado).
-- =========================================================================
create or replace function public.fn_oc_atualizar_valor_oc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'emitida' and (TG_OP = 'INSERT' or OLD.status is distinct from 'emitida') then
    if NEW.emitida_em is null then
      NEW.emitida_em := now();
    end if;
    -- Acumula por card_recurso_id; soma todas as OCs emitidas que tocam o card.
    update public.card_recursos cr
       set valor_oc = sub.total,
           updated_at = now()
      from (
        select r.card_recurso_id, sum(oci.valor_total)::numeric(14,2) as total
          from public.ordem_compra_itens oci
          join public.requisicoes r on r.id = oci.requisicao_id
          join public.ordens_compra oc on oc.id = oci.ordem_compra_id
         where oc.status = 'emitida'
           and r.card_recurso_id is not null
         group by r.card_recurso_id
      ) sub
     where cr.card_id = sub.card_recurso_id;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_oc_atualizar_valor_oc on public.ordens_compra;
create trigger trg_oc_atualizar_valor_oc
before insert or update of status on public.ordens_compra
for each row execute function public.fn_oc_atualizar_valor_oc();

-- =========================================================================
-- GRANTs e RLS — padrão Fase 2/4: leitura company-wide; escrita por papel
-- =========================================================================

-- Grupo A: Compras + GM (cadastros e documentos comerciais)
do $$
declare t text;
begin
  foreach t in array array[
    'fornecedores','cotacoes','cotacao_propostas',
    'ordens_compra','ordem_compra_itens',
    'estoque_saldos','estoque_movimentacoes'
  ] loop
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
      )
      with check (
        public.current_is_gm()
        or public.current_has_setor('Compras')
      );
    $p$, t);
  end loop;
end $$;

-- Grupo B: Compras + Producao + Engenharia + GM
-- (requisicoes nascem no campo/engenharia; recebimentos acontecem na obra)
do $$
declare t text;
begin
  foreach t in array array[
    'requisicoes','recebimento_materiais','recebimento_itens'
  ] loop
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
        or public.current_has_setor('Producao')
        or public.current_has_setor('Engenharia')
      )
      with check (
        public.current_is_gm()
        or public.current_has_setor('Compras')
        or public.current_has_setor('Producao')
        or public.current_has_setor('Engenharia')
      );
    $p$, t);
  end loop;
end $$;
