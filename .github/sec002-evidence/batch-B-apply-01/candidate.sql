-- SEC-002 · batch-B · candidate migration (evidência — não é migração executada)
-- DRI: Cappucceno (GM) / Lovable · ref: R149 · spec: R148 (SEC-002.batch-B.migration.apply-01.spec-01)
-- Fonte canônica: SEC-002.batch-B.spec-01 §§ 3, 5, 6, 7 + SEC-002.batch-B.migration.spec-01 §§ 3–6.
-- 13 tabelas registry/transversal em UMA transação. Ordem alfabética.
-- target_deploy_path: supabase/migrations/<yyyymmddhhmmss>_sec_002_batch_b.sql (timestamp diferido).
-- NENHUMA aplicação real ocorre por este arquivo — mora em .github/sec002-evidence/batch-B-apply-01/.

begin;

-- ============================================================================
-- 1. audit_logs — REGISTRY-OPEN-READ (variante: SELECT restrito a GM/admin)
-- ============================================================================
drop policy if exists "audit_logs_authenticated_all"    on public.audit_logs;
drop policy if exists "audit_logs_select_authenticated" on public.audit_logs;
drop policy if exists "audit_logs_write_gm_admin"       on public.audit_logs;

create policy "audit_logs_select_gm_admin"
  on public.audit_logs
  for select
  to authenticated
  using (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

create policy "audit_logs_write_gm_admin"
  on public.audit_logs
  for all
  to authenticated
  using      (public.current_is_gm() or public.has_role(auth.uid(), 'admin'))
  with check (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon;
grant  select, insert, update, delete on public.audit_logs to authenticated;
grant  all on public.audit_logs to service_role;

-- ============================================================================
-- 2. centros_custo_totvs — REGISTRY-OPEN-READ
-- ============================================================================
drop policy if exists "centros_custo_totvs_authenticated_all"    on public.centros_custo_totvs;
drop policy if exists "centros_custo_totvs_select_authenticated" on public.centros_custo_totvs;
drop policy if exists "centros_custo_totvs_write_gm_admin"       on public.centros_custo_totvs;

create policy "centros_custo_totvs_select_authenticated"
  on public.centros_custo_totvs
  for select
  to authenticated
  using (true);

create policy "centros_custo_totvs_write_gm_admin"
  on public.centros_custo_totvs
  for all
  to authenticated
  using      (public.current_is_gm() or public.has_role(auth.uid(), 'admin'))
  with check (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

alter table public.centros_custo_totvs enable row level security;
revoke all on public.centros_custo_totvs from anon;
grant  select, insert, update, delete on public.centros_custo_totvs to authenticated;
grant  all on public.centros_custo_totvs to service_role;

-- ============================================================================
-- 3. clientes — REGISTRY-OPEN-READ
-- ============================================================================
drop policy if exists "clientes_authenticated_all"    on public.clientes;
drop policy if exists "clientes_select_authenticated" on public.clientes;
drop policy if exists "clientes_write_gm_admin"       on public.clientes;

create policy "clientes_select_authenticated"
  on public.clientes
  for select
  to authenticated
  using (true);

create policy "clientes_write_gm_admin"
  on public.clientes
  for all
  to authenticated
  using      (public.current_is_gm() or public.has_role(auth.uid(), 'admin'))
  with check (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

alter table public.clientes enable row level security;
revoke all on public.clientes from anon;
grant  select, insert, update, delete on public.clientes to authenticated;
grant  all on public.clientes to service_role;

-- ============================================================================
-- 4. documento_tipos — REGISTRY-OPEN-READ
-- ============================================================================
drop policy if exists "documento_tipos_authenticated_all"    on public.documento_tipos;
drop policy if exists "documento_tipos_select_authenticated" on public.documento_tipos;
drop policy if exists "documento_tipos_write_gm_admin"       on public.documento_tipos;

create policy "documento_tipos_select_authenticated"
  on public.documento_tipos
  for select
  to authenticated
  using (true);

create policy "documento_tipos_write_gm_admin"
  on public.documento_tipos
  for all
  to authenticated
  using      (public.current_is_gm() or public.has_role(auth.uid(), 'admin'))
  with check (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

alter table public.documento_tipos enable row level security;
revoke all on public.documento_tipos from anon;
grant  select, insert, update, delete on public.documento_tipos to authenticated;
grant  all on public.documento_tipos to service_role;

-- ============================================================================
-- 5. empresas — REGISTRY-OPEN-READ
-- ============================================================================
drop policy if exists "empresas_authenticated_all"    on public.empresas;
drop policy if exists "empresas_select_authenticated" on public.empresas;
drop policy if exists "empresas_write_gm_admin"       on public.empresas;

create policy "empresas_select_authenticated"
  on public.empresas
  for select
  to authenticated
  using (true);

create policy "empresas_write_gm_admin"
  on public.empresas
  for all
  to authenticated
  using      (public.current_is_gm() or public.has_role(auth.uid(), 'admin'))
  with check (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

alter table public.empresas enable row level security;
revoke all on public.empresas from anon;
grant  select, insert, update, delete on public.empresas to authenticated;
grant  all on public.empresas to service_role;

-- ============================================================================
-- 6. formas_pagamento — REGISTRY-OPEN-READ (write: gm ∪ financeiro ∪ admin)
-- ============================================================================
drop policy if exists "formas_pagamento_authenticated_all"    on public.formas_pagamento;
drop policy if exists "formas_pagamento_select_authenticated" on public.formas_pagamento;
drop policy if exists "formas_pagamento_write_gm_fin_admin"   on public.formas_pagamento;

create policy "formas_pagamento_select_authenticated"
  on public.formas_pagamento
  for select
  to authenticated
  using (true);

create policy "formas_pagamento_write_gm_fin_admin"
  on public.formas_pagamento
  for all
  to authenticated
  using (
    public.current_is_gm()
    or public.has_role(auth.uid(), 'financeiro')
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.current_is_gm()
    or public.has_role(auth.uid(), 'financeiro')
    or public.has_role(auth.uid(), 'admin')
  );

alter table public.formas_pagamento enable row level security;
revoke all on public.formas_pagamento from anon;
grant  select, insert, update, delete on public.formas_pagamento to authenticated;
grant  all on public.formas_pagamento to service_role;

-- ============================================================================
-- 7. funcoes — REGISTRY-OPEN-READ
-- ============================================================================
drop policy if exists "funcoes_authenticated_all"    on public.funcoes;
drop policy if exists "funcoes_select_authenticated" on public.funcoes;
drop policy if exists "funcoes_write_gm_admin"       on public.funcoes;

create policy "funcoes_select_authenticated"
  on public.funcoes
  for select
  to authenticated
  using (true);

create policy "funcoes_write_gm_admin"
  on public.funcoes
  for all
  to authenticated
  using      (public.current_is_gm() or public.has_role(auth.uid(), 'admin'))
  with check (public.current_is_gm() or public.has_role(auth.uid(), 'admin'));

alter table public.funcoes enable row level security;
revoke all on public.funcoes from anon;
grant  select, insert, update, delete on public.funcoes to authenticated;
grant  all on public.funcoes to service_role;

-- ============================================================================
-- 8. notificacoes — OWNER-SELF (destinatario_id) · sem DELETE por authenticated
-- ============================================================================
drop policy if exists "notificacoes_authenticated_all"       on public.notificacoes;
drop policy if exists "notificacoes_select_owner_or_gm"      on public.notificacoes;
drop policy if exists "notificacoes_write_service_or_gm"     on public.notificacoes;
drop policy if exists "notificacoes_update_owner_or_gm"      on public.notificacoes;

create policy "notificacoes_select_owner_or_gm"
  on public.notificacoes
  for select
  to authenticated
  using (public.current_is_gm() or destinatario_id = auth.uid());

create policy "notificacoes_insert_gm_only"
  on public.notificacoes
  for insert
  to authenticated
  with check (public.current_is_gm());

create policy "notificacoes_update_owner_or_gm"
  on public.notificacoes
  for update
  to authenticated
  using      (public.current_is_gm() or destinatario_id = auth.uid())
  with check (public.current_is_gm() or destinatario_id = auth.uid());

alter table public.notificacoes enable row level security;
revoke all on public.notificacoes from anon;
grant  select, insert, update, delete on public.notificacoes to authenticated;
grant  all on public.notificacoes to service_role;

-- ============================================================================
-- 9. plano_contas — REGISTRY-OPEN-READ (write: gm ∪ financeiro ∪ admin)
-- ============================================================================
drop policy if exists "plano_contas_authenticated_all"    on public.plano_contas;
drop policy if exists "plano_contas_select_authenticated" on public.plano_contas;
drop policy if exists "plano_contas_write_gm_fin_admin"   on public.plano_contas;

create policy "plano_contas_select_authenticated"
  on public.plano_contas
  for select
  to authenticated
  using (true);

create policy "plano_contas_write_gm_fin_admin"
  on public.plano_contas
  for all
  to authenticated
  using (
    public.current_is_gm()
    or public.has_role(auth.uid(), 'financeiro')
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    public.current_is_gm()
    or public.has_role(auth.uid(), 'financeiro')
    or public.has_role(auth.uid(), 'admin')
  );

alter table public.plano_contas enable row level security;
revoke all on public.plano_contas from anon;
grant  select, insert, update, delete on public.plano_contas to authenticated;
grant  all on public.plano_contas to service_role;

-- ============================================================================
-- 10. players — SELECT aberto a authenticated; WRITE owner-or-gm (id)
-- ============================================================================
drop policy if exists "players_authenticated_all"    on public.players;
drop policy if exists "players_select_authenticated" on public.players;
drop policy if exists "players_write_owner_or_gm"    on public.players;

create policy "players_select_authenticated"
  on public.players
  for select
  to authenticated
  using (true);

create policy "players_write_owner_or_gm"
  on public.players
  for all
  to authenticated
  using      (public.current_is_gm() or id = auth.uid())
  with check (public.current_is_gm() or id = auth.uid());

alter table public.players enable row level security;
revoke all on public.players from anon;
grant  select, insert, update, delete on public.players to authenticated;
grant  all on public.players to service_role;

-- ============================================================================
-- 11. profiles — SELECT aberto a authenticated; WRITE owner-or-gm (id)
-- ============================================================================
drop policy if exists "profiles_authenticated_all"    on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_write_owner_or_gm"    on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_write_owner_or_gm"
  on public.profiles
  for all
  to authenticated
  using      (public.current_is_gm() or id = auth.uid())
  with check (public.current_is_gm() or id = auth.uid());

alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant  select, insert, update, delete on public.profiles to authenticated;
grant  all on public.profiles to service_role;

-- ============================================================================
-- 12. user_empresas — OWNER-SELF (user_id); escrita = GM
-- ============================================================================
drop policy if exists "user_empresas_authenticated_all"    on public.user_empresas;
drop policy if exists "user_empresas_select_owner_or_gm"   on public.user_empresas;
drop policy if exists "user_empresas_write_gm"             on public.user_empresas;

create policy "user_empresas_select_owner_or_gm"
  on public.user_empresas
  for select
  to authenticated
  using (public.current_is_gm() or user_id = auth.uid());

create policy "user_empresas_write_gm"
  on public.user_empresas
  for all
  to authenticated
  using      (public.current_is_gm())
  with check (public.current_is_gm());

alter table public.user_empresas enable row level security;
revoke all on public.user_empresas from anon;
grant  select, insert, update, delete on public.user_empresas to authenticated;
grant  all on public.user_empresas to service_role;

-- ============================================================================
-- 13. user_roles — ROLES-READ-VIA-DEFINER · grant SELECT-only a authenticated
-- ============================================================================
drop policy if exists "user_roles_authenticated_all" on public.user_roles;
drop policy if exists "user_roles_select_gm_only"    on public.user_roles;
drop policy if exists "user_roles_write_gm"          on public.user_roles;

create policy "user_roles_select_gm_only"
  on public.user_roles
  for select
  to authenticated
  using (public.current_is_gm());

create policy "user_roles_write_gm"
  on public.user_roles
  for all
  to authenticated
  using      (public.current_is_gm())
  with check (public.current_is_gm());

alter table public.user_roles enable row level security;
revoke all    on public.user_roles from anon;
grant  select on public.user_roles to authenticated;
grant  all    on public.user_roles to service_role;

-- Reload PostgREST schema cache (§10.R4 batch-B.migration.spec-01)
notify pgrst, 'reload schema';

commit;
