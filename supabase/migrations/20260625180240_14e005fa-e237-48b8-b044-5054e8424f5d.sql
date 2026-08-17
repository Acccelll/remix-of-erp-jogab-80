-- =========================================================================
-- RDO (Relatório Diário de Obra) — Fase 4.3
-- IDs do tipo uuid são gerados no cliente para garantir idempotência do
-- motor offline (mesma linha sobrevive a retries).
-- =========================================================================

create table if not exists public.rdo (
  id uuid primary key,
  obra_id uuid not null references public.obras(id) on delete cascade,
  data date not null,
  owner_id uuid references public.profiles(id) on delete set null,
  clima_manha text,
  clima_tarde text,
  clima_noite text,
  trabalhavel_manha boolean,
  trabalhavel_tarde boolean,
  trabalhavel_noite boolean,
  observacoes text not null default '',
  status text not null default 'rascunho',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz,
  unique (obra_id, data)
);

create table if not exists public.rdo_efetivo (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdo(id) on delete cascade,
  colaborador_id uuid references public.colaboradores(id) on delete set null,
  funcao_id uuid references public.funcoes(id) on delete set null,
  quantidade integer not null default 1,
  presente boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rdo_atividades (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdo(id) on delete cascade,
  cronograma_item_id uuid references public.cronograma_itens(id) on delete set null,
  descricao text not null default '',
  quantidade numeric(14,4),
  created_at timestamptz not null default now()
);

create table if not exists public.rdo_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.rdo(id) on delete cascade,
  tipo text not null,
  descricao text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.rdo_fotos (
  id uuid primary key,
  rdo_id uuid not null references public.rdo(id) on delete cascade,
  storage_path text not null default '',
  legenda text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_rdo_obra_data on public.rdo(obra_id, data);
create index if not exists idx_rdo_efetivo_rdo on public.rdo_efetivo(rdo_id);
create index if not exists idx_rdo_atividades_rdo on public.rdo_atividades(rdo_id);
create index if not exists idx_rdo_atividades_cron on public.rdo_atividades(cronograma_item_id);
create index if not exists idx_rdo_ocorrencias_rdo on public.rdo_ocorrencias(rdo_id);
create index if not exists idx_rdo_fotos_rdo on public.rdo_fotos(rdo_id);

-- updated_at trigger no cabeçalho
drop trigger if exists trg_rdo_updated_at on public.rdo;
create trigger trg_rdo_updated_at
before update on public.rdo
for each row execute function public.touch_updated_at();

-- GRANTs e RLS — padrão Fase 0: leitura company-wide, escrita por papel
do $$
declare t text;
begin
  foreach t in array array['rdo','rdo_efetivo','rdo_atividades','rdo_ocorrencias','rdo_fotos'] loop
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
        or public.current_has_setor('Engenharia')
        or public.current_has_setor('Producao')
      )
      with check (
        public.current_is_gm()
        or public.current_has_setor('Engenharia')
        or public.current_has_setor('Producao')
      );
    $p$, t);
  end loop;
end $$;

-- =========================================================================
-- Storage: bucket rdo-fotos (criado via tool) — políticas em storage.objects
-- Mesmo padrão do card-anexos: authenticated tem CRUD; anon não acessa.
-- =========================================================================

drop policy if exists "rdo-fotos select" on storage.objects;
drop policy if exists "rdo-fotos insert" on storage.objects;
drop policy if exists "rdo-fotos update" on storage.objects;
drop policy if exists "rdo-fotos delete" on storage.objects;

create policy "rdo-fotos select" on storage.objects
for select to authenticated
using (bucket_id = 'rdo-fotos');

create policy "rdo-fotos insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'rdo-fotos');

create policy "rdo-fotos update" on storage.objects
for update to authenticated
using (bucket_id = 'rdo-fotos')
with check (bucket_id = 'rdo-fotos');

create policy "rdo-fotos delete" on storage.objects
for delete to authenticated
using (bucket_id = 'rdo-fotos');