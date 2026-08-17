
-- profiles: identidade ligada ao auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  login      text unique,
  email      text not null default '',
  is_gm      boolean not null default false,
  acessos    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- membership de setor
create table if not exists public.user_setores (
  user_id  uuid not null references auth.users(id) on delete cascade,
  setor    text not null check (setor in
            ('Engenharia','Compras','Contratos','RH','Producao','Financeiro','Geral')),
  subsetor text check (subsetor in ('Solda','Corte','Dobra')),
  primary key (user_id, setor)
);

-- GRANTs (obrigatórios para PostgREST)
revoke all on public.profiles from anon;
revoke all on public.user_setores from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_setores to authenticated;
grant all on public.profiles to service_role;
grant all on public.user_setores to service_role;

-- helpers SECURITY DEFINER (bypassam RLS → sem recursão nas policies)
create or replace function public.current_is_gm()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select is_gm from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_setores()
returns text[] language sql security definer set search_path = public stable as $$
  select coalesce(array_agg(setor), '{}') from public.user_setores where user_id = auth.uid();
$$;

create or replace function public.has_card_setor(p_card_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.current_is_gm() or exists (
    select 1 from public.card_setores cs
    where cs.card_id = p_card_id and cs.setor = any(public.current_setores())
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_setores enable row level security;

create policy "profiles self read"  on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_is_gm());
create policy "profiles self write" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles gm manage"  on public.profiles for all to authenticated
  using (public.current_is_gm()) with check (public.current_is_gm());

create policy "user_setores read" on public.user_setores for select to authenticated
  using (user_id = auth.uid() or public.current_is_gm());
create policy "user_setores gm manage" on public.user_setores for all to authenticated
  using (public.current_is_gm()) with check (public.current_is_gm());
