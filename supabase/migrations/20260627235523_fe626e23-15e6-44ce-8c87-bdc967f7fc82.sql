
-- ============================================================================
-- H1.3 (parte 2) — RPCs atômicos para Notas Fiscais
-- ============================================================================

-- salvar_nf_atomica
create or replace function public.salvar_nf_atomica(
  p_nf_id                uuid,        -- null = inserir; preenchido = editar
  p_payload              jsonb,       -- campos de notas_fiscais (sem id/created_at/updated_at)
  p_data_prevista        date,        -- data prevista do recebimento
  p_valor_liquido        numeric,     -- líquido (usado no recebimento)
  p_bms_prevista_id      uuid,        -- BMS escolhida no formulário (pode ser null)
  p_medicao_id_fallback  uuid,        -- usado quando insert sem BMS manual mas com medição
  p_valor_contrato       numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nf_id          uuid;
  v_obra_id        uuid;
  v_bms_atual_id   uuid;
begin
  v_obra_id := (p_payload->>'obra_id')::uuid;
  if v_obra_id is null then
    raise exception 'payload sem obra_id';
  end if;

  if p_nf_id is null then
    -- INSERT
    insert into public.notas_fiscais
    select * from jsonb_populate_record(null::public.notas_fiscais, p_payload)
    returning id into v_nf_id;

    insert into public.recebimentos (
      obra_id, nota_fiscal_id, data_prevista,
      valor_previsto, valor_previsto_inicial,
      status, origem, congelado
    )
    values (
      v_obra_id, v_nf_id, p_data_prevista,
      p_valor_liquido, p_valor_liquido,
      'a_receber', 'nf', true
    );
  else
    -- UPDATE
    v_nf_id := p_nf_id;

    update public.notas_fiscais nf
    set obra_id            = coalesce(p.obra_id, nf.obra_id),
        medicao_id         = p.medicao_id,
        numero             = p.numero,
        data_emissao       = p.data_emissao,
        competencia        = p.competencia,
        valor              = coalesce(p.valor, nf.valor),
        valor_servicos     = p.valor_servicos,
        valor_material     = p.valor_material,
        percentual_material= p.percentual_material,
        inss_retido        = p.inss_retido,
        iss_retido         = p.iss_retido,
        retencao_cbs       = p.retencao_cbs,
        retencao_ibs       = p.retencao_ibs,
        outras_retencoes   = p.outras_retencoes,
        valor_liquido      = p.valor_liquido,
        codigo_cno         = p.codigo_cno,
        codigo_art         = p.codigo_art,
        codigo_verificacao = p.codigo_verificacao,
        data_vencimento    = p.data_vencimento,
        pdf_url            = coalesce(p.pdf_url, nf.pdf_url)
    from jsonb_populate_record(null::public.notas_fiscais, p_payload) p
    where nf.id = p_nf_id;

    update public.recebimentos
    set valor_previsto         = p_valor_liquido,
        valor_previsto_inicial = p_valor_liquido,
        data_prevista          = p_data_prevista
    where nota_fiscal_id = p_nf_id
      and data_recebimento is null;
  end if;

  -- Sincroniza vínculo de BMS prevista
  select id into v_bms_atual_id
  from public.bms_previstas
  where nota_fiscal_id = v_nf_id
  limit 1;

  if v_bms_atual_id is not null and v_bms_atual_id is distinct from p_bms_prevista_id then
    update public.bms_previstas
    set nota_fiscal_id = null, status = 'prevista'
    where id = v_bms_atual_id;
  end if;

  if p_bms_prevista_id is not null
     and (v_bms_atual_id is null or v_bms_atual_id is distinct from p_bms_prevista_id) then
    update public.bms_previstas
    set nota_fiscal_id = v_nf_id, status = 'faturada'
    where id = p_bms_prevista_id;
  elsif p_nf_id is null
        and p_bms_prevista_id is null
        and p_medicao_id_fallback is not null then
    update public.bms_previstas
    set nota_fiscal_id = v_nf_id, status = 'faturada'
    where obra_id = v_obra_id
      and medicao_id = p_medicao_id_fallback;
  end if;

  -- Recalcula a previsão das BMS futuras
  perform public.fn_recalcular_previsao_nf(v_obra_id, p_valor_contrato);

  return jsonb_build_object(
    'nf_id', v_nf_id,
    'obra_id', v_obra_id
  );
end;
$$;

revoke all on function public.salvar_nf_atomica(uuid, jsonb, date, numeric, uuid, uuid, numeric) from public;
grant execute on function public.salvar_nf_atomica(uuid, jsonb, date, numeric, uuid, uuid, numeric) to authenticated, service_role;


-- excluir_nf_atomica
create or replace function public.excluir_nf_atomica(
  p_nf_id          uuid,
  p_valor_contrato numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_obra_id uuid;
begin
  select obra_id into v_obra_id from public.notas_fiscais where id = p_nf_id;
  if v_obra_id is null then
    raise exception 'NF % não encontrada', p_nf_id;
  end if;

  -- Desvincula BMS previstas que apontavam para esta NF
  update public.bms_previstas
  set nota_fiscal_id = null, status = 'prevista'
  where nota_fiscal_id = p_nf_id;

  -- Remove recebimentos previstos (apenas os ainda não recebidos)
  delete from public.recebimentos
  where nota_fiscal_id = p_nf_id
    and data_recebimento is null;

  -- Apaga a NF
  delete from public.notas_fiscais where id = p_nf_id;

  -- Recalcula previsão
  perform public.fn_recalcular_previsao_nf(v_obra_id, p_valor_contrato);

  return jsonb_build_object('obra_id', v_obra_id);
end;
$$;

revoke all on function public.excluir_nf_atomica(uuid, numeric) from public;
grant execute on function public.excluir_nf_atomica(uuid, numeric) to authenticated, service_role;
