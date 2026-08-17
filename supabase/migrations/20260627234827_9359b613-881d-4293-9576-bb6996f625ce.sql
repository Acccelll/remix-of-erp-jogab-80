
-- ============================================================================
-- H1.3 — Robustez transacional: RPCs atômicos para medições e fechamento de BMS
-- ============================================================================

-- 1) criar_medicao_atomica
-- Cria medicao + itens_medicao + atualiza percentual_realizado dos itens do
-- cronograma + (opcional) marca a BMS prevista como 'aberta' vinculada à
-- medição recém-criada. Tudo em uma transação.
create or replace function public.criar_medicao_atomica(
  p_obra_id        uuid,
  p_numero         text,
  p_data_inicio    date,
  p_data_corte     date,
  p_observacoes    text,
  p_valor_total    numeric,
  p_itens          jsonb,        -- [{cronograma_item_id, percentual_anterior, percentual_atual, valor_anterior, valor_atual}]
  p_bms_id         uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_baseline_id uuid;
  v_medicao_id  uuid;
begin
  -- Baseline vigente (maior versão da obra)
  select id into v_baseline_id
  from public.cronograma_baselines
  where obra_id = p_obra_id
  order by versao desc
  limit 1;

  insert into public.medicoes (
    obra_id, numero, data_inicio, data_corte, valor, status, observacoes, baseline_id
  ) values (
    p_obra_id,
    p_numero,
    p_data_inicio,
    p_data_corte,
    coalesce(p_valor_total, 0),
    'rascunho',
    nullif(p_observacoes, ''),
    v_baseline_id
  )
  returning id into v_medicao_id;

  -- Itens da medição (apenas linhas com execução)
  if p_itens is not null and jsonb_array_length(p_itens) > 0 then
    insert into public.itens_medicao (
      medicao_id, cronograma_item_id,
      percentual_anterior, percentual_atual,
      valor_anterior, valor_atual
    )
    select
      v_medicao_id,
      (it->>'cronograma_item_id')::uuid,
      coalesce((it->>'percentual_anterior')::numeric, 0),
      coalesce((it->>'percentual_atual')::numeric, 0),
      coalesce((it->>'valor_anterior')::numeric, 0),
      coalesce((it->>'valor_atual')::numeric, 0)
    from jsonb_array_elements(p_itens) as it
    where (it->>'cronograma_item_id') is not null;

    -- Atualiza % realizado no cronograma
    update public.cronograma_itens ci
    set percentual_realizado = sub.pct_atual
    from (
      select
        (it->>'cronograma_item_id')::uuid as item_id,
        coalesce((it->>'percentual_atual')::numeric, 0) as pct_atual
      from jsonb_array_elements(p_itens) as it
      where (it->>'cronograma_item_id') is not null
    ) sub
    where ci.id = sub.item_id;
  end if;

  -- Vínculo opcional com BMS prevista (abertura via Previsão → Medição)
  if p_bms_id is not null then
    update public.bms_previstas
    set status = 'aberta',
        medicao_id = v_medicao_id
    where id = p_bms_id;
  end if;

  return v_medicao_id;
end;
$$;

revoke all on function public.criar_medicao_atomica(uuid, text, date, date, text, numeric, jsonb, uuid) from public;
grant execute on function public.criar_medicao_atomica(uuid, text, date, date, text, numeric, jsonb, uuid) to authenticated, service_role;


-- 2) fechar_bms_atomica
-- Fecha a BMS (status='fechada', valor_previsto_dinamico = realizado),
-- atualiza o valor_previsto_dinamico das BMS futuras conforme redistribuição,
-- e regrava o histórico em bms_redistribuicao (delete + insert).
create or replace function public.fechar_bms_atomica(
  p_bms_id          uuid,
  p_valor_realizado numeric,
  p_futuras         jsonb,        -- [{id, valor_novo}]
  p_registros       jsonb         -- [{bms_destino_numero, cronograma_item_id, descricao_item, valor_atrasado, valor_absorvido, motivo}]
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra_id        uuid;
  v_origem_numero  integer;
begin
  select obra_id, numero
  into v_obra_id, v_origem_numero
  from public.bms_previstas
  where id = p_bms_id
  for update;

  if v_obra_id is null then
    raise exception 'BMS % não encontrada', p_bms_id;
  end if;

  -- 1. Marca a BMS como fechada e fixa o realizado como dinâmico
  update public.bms_previstas
  set status = 'fechada',
      valor_previsto_dinamico = coalesce(p_valor_realizado, valor_previsto_dinamico)
  where id = p_bms_id;

  -- 2. Atualiza valor_previsto_dinamico das BMS futuras
  if p_futuras is not null and jsonb_array_length(p_futuras) > 0 then
    update public.bms_previstas bp
    set valor_previsto_dinamico = sub.valor_novo
    from (
      select
        (f->>'id')::uuid as id,
        (f->>'valor_novo')::numeric as valor_novo
      from jsonb_array_elements(p_futuras) as f
      where (f->>'id') is not null
    ) sub
    where bp.id = sub.id
      and abs(bp.valor_previsto_dinamico - sub.valor_novo) >= 0.005;
  end if;

  -- 3. Regrava o histórico de redistribuição desta BMS de origem
  delete from public.bms_redistribuicao
  where obra_id = v_obra_id
    and bms_origem_numero = v_origem_numero;

  if p_registros is not null and jsonb_array_length(p_registros) > 0 then
    insert into public.bms_redistribuicao (
      obra_id, bms_origem_numero, bms_destino_numero,
      cronograma_item_id, descricao_item, valor_atrasado, valor_absorvido, motivo
    )
    select
      v_obra_id,
      v_origem_numero,
      (r->>'bms_destino_numero')::integer,
      nullif(r->>'cronograma_item_id', '')::uuid,
      r->>'descricao_item',
      coalesce((r->>'valor_atrasado')::numeric, 0),
      coalesce((r->>'valor_absorvido')::numeric, 0),
      r->>'motivo'
    from jsonb_array_elements(p_registros) as r;
  end if;
end;
$$;

revoke all on function public.fechar_bms_atomica(uuid, numeric, jsonb, jsonb) from public;
grant execute on function public.fechar_bms_atomica(uuid, numeric, jsonb, jsonb) to authenticated, service_role;
