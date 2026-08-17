-- DB-001.a — Guardrails de fronteira: formato + relatório de órfãos

CREATE OR REPLACE FUNCTION public.db001_legacy_id_is_valid(_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _value IS NOT NULL
    AND btrim(_value) <> ''
    AND length(_value) <= 128
    AND _value ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
$$;

-- Colunas obrigatórias de fronteira.
ALTER TABLE public.custo_colaborador_competencia
  ADD CONSTRAINT db001_custo_colaborador_competencia_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.decimo_terceiro
  ADD CONSTRAINT db001_decimo_terceiro_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.fopag_entries
  ADD CONSTRAINT db001_fopag_entries_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.historico_salarial
  ADD CONSTRAINT db001_historico_salarial_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.horas_extras
  ADD CONSTRAINT db001_horas_extras_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.mobilizacoes_periodos
  ADD CONSTRAINT db001_mobilizacoes_periodos_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.mobilizacoes_periodos
  ADD CONSTRAINT db001_mobilizacoes_periodos_obra_id_fmt
  CHECK (public.db001_legacy_id_is_valid(obra_id)) NOT VALID;

ALTER TABLE public.mobilizacoes_veiculos
  ADD CONSTRAINT db001_mobilizacoes_veiculos_obra_id_fmt
  CHECK (public.db001_legacy_id_is_valid(obra_id)) NOT VALID;

ALTER TABLE public.mobilizacoes_veiculos
  ADD CONSTRAINT db001_mobilizacoes_veiculos_veiculo_id_fmt
  CHECK (public.db001_legacy_id_is_valid(veiculo_id)) NOT VALID;

ALTER TABLE public.provisoes
  ADD CONSTRAINT db001_provisoes_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.responsabilidades_patrimonios
  ADD CONSTRAINT db001_responsabilidades_patrimonios_colaborador_id_fmt
  CHECK (public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.responsabilidades_patrimonios
  ADD CONSTRAINT db001_responsabilidades_patrimonios_patrimonio_id_fmt
  CHECK (public.db001_legacy_id_is_valid(patrimonio_id)) NOT VALID;

-- Colunas opcionais de fronteira.
ALTER TABLE public.colaboradores
  ADD CONSTRAINT db001_colaboradores_obra_atual_id_fmt
  CHECK (obra_atual_id IS NULL OR public.db001_legacy_id_is_valid(obra_atual_id)) NOT VALID;

ALTER TABLE public.controle_despesas
  ADD CONSTRAINT db001_controle_despesas_centro_custo_id_fmt
  CHECK (centro_custo_id IS NULL OR public.db001_legacy_id_is_valid(centro_custo_id)) NOT VALID;

ALTER TABLE public.custo_colaborador_competencia
  ADD CONSTRAINT db001_custo_colaborador_competencia_centro_custo_id_fmt
  CHECK (centro_custo_id IS NULL OR public.db001_legacy_id_is_valid(centro_custo_id)) NOT VALID;

ALTER TABLE public.dp_holerite
  ADD CONSTRAINT db001_dp_holerite_colaborador_id_fmt
  CHECK (colaborador_id IS NULL OR public.db001_legacy_id_is_valid(colaborador_id)) NOT VALID;

ALTER TABLE public.horas_extras
  ADD CONSTRAINT db001_horas_extras_obra_id_fmt
  CHECK (obra_id IS NULL OR public.db001_legacy_id_is_valid(obra_id)) NOT VALID;

ALTER TABLE public.patrimonios
  ADD CONSTRAINT db001_patrimonios_obra_atual_id_fmt
  CHECK (obra_atual_id IS NULL OR public.db001_legacy_id_is_valid(obra_atual_id)) NOT VALID;

ALTER TABLE public.patrimonios
  ADD CONSTRAINT db001_patrimonios_responsavel_id_fmt
  CHECK (responsavel_id IS NULL OR public.db001_legacy_id_is_valid(responsavel_id)) NOT VALID;

ALTER TABLE public.solicitacoes_financeiras
  ADD CONSTRAINT db001_solicitacoes_financeiras_centro_custo_id_fmt
  CHECK (centro_custo_id IS NULL OR public.db001_legacy_id_is_valid(centro_custo_id)) NOT VALID;

ALTER TABLE public.veiculos
  ADD CONSTRAINT db001_veiculos_obra_atual_id_fmt
  CHECK (obra_atual_id IS NULL OR public.db001_legacy_id_is_valid(obra_atual_id)) NOT VALID;

CREATE OR REPLACE VIEW public.vw_db001_fronteira_orfaos
WITH (security_invoker = true) AS
SELECT 'colaboradores'::text AS tabela, 'obra_atual_id'::text AS coluna, 'obras'::text AS tabela_referencia, c.obra_atual_id AS valor, count(*)::bigint AS total
FROM public.colaboradores c
LEFT JOIN public.obras o ON o.id::text = c.obra_atual_id
WHERE c.obra_atual_id IS NOT NULL AND o.id IS NULL
GROUP BY c.obra_atual_id
UNION ALL
SELECT 'patrimonios', 'obra_atual_id', 'obras', p.obra_atual_id, count(*)::bigint
FROM public.patrimonios p
LEFT JOIN public.obras o ON o.id::text = p.obra_atual_id
WHERE p.obra_atual_id IS NOT NULL AND o.id IS NULL
GROUP BY p.obra_atual_id
UNION ALL
SELECT 'patrimonios', 'responsavel_id', 'colaboradores', p.responsavel_id, count(*)::bigint
FROM public.patrimonios p
LEFT JOIN public.colaboradores c ON c.id::text = p.responsavel_id
WHERE p.responsavel_id IS NOT NULL AND c.id IS NULL
GROUP BY p.responsavel_id
UNION ALL
SELECT 'veiculos', 'obra_atual_id', 'obras', v.obra_atual_id, count(*)::bigint
FROM public.veiculos v
LEFT JOIN public.obras o ON o.id::text = v.obra_atual_id
WHERE v.obra_atual_id IS NOT NULL AND o.id IS NULL
GROUP BY v.obra_atual_id
UNION ALL
SELECT 'mobilizacoes_periodos', 'colaborador_id', 'colaboradores', mp.colaborador_id, count(*)::bigint
FROM public.mobilizacoes_periodos mp
LEFT JOIN public.colaboradores c ON c.id::text = mp.colaborador_id
WHERE c.id IS NULL
GROUP BY mp.colaborador_id
UNION ALL
SELECT 'mobilizacoes_periodos', 'obra_id', 'obras', mp.obra_id, count(*)::bigint
FROM public.mobilizacoes_periodos mp
LEFT JOIN public.obras o ON o.id::text = mp.obra_id
WHERE o.id IS NULL
GROUP BY mp.obra_id
UNION ALL
SELECT 'mobilizacoes_veiculos', 'veiculo_id', 'veiculos', mv.veiculo_id, count(*)::bigint
FROM public.mobilizacoes_veiculos mv
LEFT JOIN public.veiculos v ON v.id::text = mv.veiculo_id
WHERE v.id IS NULL
GROUP BY mv.veiculo_id
UNION ALL
SELECT 'mobilizacoes_veiculos', 'obra_id', 'obras', mv.obra_id, count(*)::bigint
FROM public.mobilizacoes_veiculos mv
LEFT JOIN public.obras o ON o.id::text = mv.obra_id
WHERE o.id IS NULL
GROUP BY mv.obra_id
UNION ALL
SELECT 'responsabilidades_patrimonios', 'patrimonio_id', 'patrimonios', rp.patrimonio_id, count(*)::bigint
FROM public.responsabilidades_patrimonios rp
LEFT JOIN public.patrimonios p ON p.id::text = rp.patrimonio_id
WHERE p.id IS NULL
GROUP BY rp.patrimonio_id
UNION ALL
SELECT 'responsabilidades_patrimonios', 'colaborador_id', 'colaboradores', rp.colaborador_id, count(*)::bigint
FROM public.responsabilidades_patrimonios rp
LEFT JOIN public.colaboradores c ON c.id::text = rp.colaborador_id
WHERE c.id IS NULL
GROUP BY rp.colaborador_id
UNION ALL
SELECT 'dp_holerite', 'colaborador_id', 'colaboradores', dh.colaborador_id, count(*)::bigint
FROM public.dp_holerite dh
LEFT JOIN public.colaboradores c ON c.id::text = dh.colaborador_id
WHERE dh.colaborador_id IS NOT NULL AND c.id IS NULL
GROUP BY dh.colaborador_id
UNION ALL
SELECT 'fopag_entries', 'colaborador_id', 'colaboradores', fe.colaborador_id, count(*)::bigint
FROM public.fopag_entries fe
LEFT JOIN public.colaboradores c ON c.id::text = fe.colaborador_id
WHERE c.id IS NULL
GROUP BY fe.colaborador_id
UNION ALL
SELECT 'historico_salarial', 'colaborador_id', 'colaboradores', hs.colaborador_id, count(*)::bigint
FROM public.historico_salarial hs
LEFT JOIN public.colaboradores c ON c.id::text = hs.colaborador_id
WHERE c.id IS NULL
GROUP BY hs.colaborador_id
UNION ALL
SELECT 'provisoes', 'colaborador_id', 'colaboradores', pr.colaborador_id, count(*)::bigint
FROM public.provisoes pr
LEFT JOIN public.colaboradores c ON c.id::text = pr.colaborador_id
WHERE c.id IS NULL
GROUP BY pr.colaborador_id
UNION ALL
SELECT 'decimo_terceiro', 'colaborador_id', 'colaboradores', dt.colaborador_id, count(*)::bigint
FROM public.decimo_terceiro dt
LEFT JOIN public.colaboradores c ON c.id::text = dt.colaborador_id
WHERE c.id IS NULL
GROUP BY dt.colaborador_id
UNION ALL
SELECT 'horas_extras', 'colaborador_id', 'colaboradores', he.colaborador_id, count(*)::bigint
FROM public.horas_extras he
LEFT JOIN public.colaboradores c ON c.id::text = he.colaborador_id
WHERE c.id IS NULL
GROUP BY he.colaborador_id
UNION ALL
SELECT 'horas_extras', 'obra_id', 'obras', he.obra_id, count(*)::bigint
FROM public.horas_extras he
LEFT JOIN public.obras o ON o.id::text = he.obra_id
WHERE he.obra_id IS NOT NULL AND o.id IS NULL
GROUP BY he.obra_id
UNION ALL
SELECT 'custo_colaborador_competencia', 'colaborador_id', 'colaboradores', cc.colaborador_id, count(*)::bigint
FROM public.custo_colaborador_competencia cc
LEFT JOIN public.colaboradores c ON c.id::text = cc.colaborador_id
WHERE c.id IS NULL
GROUP BY cc.colaborador_id;

GRANT EXECUTE ON FUNCTION public.db001_legacy_id_is_valid(text) TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_db001_fronteira_orfaos TO authenticated, service_role;
