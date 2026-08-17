
-- campos que faltam no card
alter table public.cards
  add column if not exists responsavel_id uuid references public.profiles(id) on delete set null,
  add column if not exists prazo date;

-- etiquetas (catálogo + vínculo M:N)
create table if not exists public.card_labels (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor  text not null default '#64748b',
  created_at timestamptz not null default now()
);

create table if not exists public.card_label_links (
  card_id  uuid not null references public.cards(id) on delete cascade,
  label_id uuid not null references public.card_labels(id) on delete cascade,
  primary key (card_id, label_id)
);

-- histórico/atividade por card (log imutável)
create table if not exists public.card_atividades (
  id uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards(id) on delete cascade,
  ator_id    uuid references public.profiles(id) on delete set null,
  ator_nome  text not null default '',
  evento     text not null,
  detalhe    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_card_ativ_card on public.card_atividades (card_id, created_at);

-- notificações (stream único do sino)
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  tipo       text not null,
  card_id    uuid references public.cards(id) on delete cascade,
  texto      text not null default '',
  lida       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on public.notificacoes (user_id, lida, created_at);

-- Grants antes de RLS (padrão Lovable)
revoke all on public.card_labels       from anon;
revoke all on public.card_label_links  from anon;
revoke all on public.card_atividades   from anon;
revoke all on public.notificacoes      from anon;

grant select, insert, update, delete on public.card_labels       to authenticated;
grant select, insert, update, delete on public.card_label_links  to authenticated;
grant select, insert, update, delete on public.card_atividades   to authenticated;
grant select, insert, update, delete on public.notificacoes      to authenticated;

grant all on public.card_labels       to service_role;
grant all on public.card_label_links  to service_role;
grant all on public.card_atividades   to service_role;
grant all on public.notificacoes      to service_role;

-- RLS
alter table public.card_labels       enable row level security;
alter table public.card_label_links  enable row level security;
alter table public.card_atividades   enable row level security;
alter table public.notificacoes      enable row level security;

-- labels: catálogo compartilhado, autenticado com setor (ou GM) gerencia
create policy "labels read"   on public.card_labels for select to authenticated using (true);
create policy "labels manage" on public.card_labels for all to authenticated
  using (public.current_is_gm() or array_length(public.current_setores(),1) > 0)
  with check (public.current_is_gm() or array_length(public.current_setores(),1) > 0);

-- vínculo de label: gated pelo setor do card
create policy "label_links rw" on public.card_label_links for all to authenticated
  using (public.has_card_setor(card_id)) with check (public.has_card_setor(card_id));

-- atividade: lê quem vê o card; insere quem vê o card; imutável (sem update; delete só GM)
create policy "ativ read"   on public.card_atividades for select to authenticated
  using (public.has_card_setor(card_id));
create policy "ativ ins"    on public.card_atividades for insert to authenticated
  with check (public.has_card_setor(card_id));
create policy "ativ gm del" on public.card_atividades for delete to authenticated
  using (public.current_is_gm());

-- notificações: cada um só vê/atualiza as suas
create policy "notif own" on public.notificacoes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
