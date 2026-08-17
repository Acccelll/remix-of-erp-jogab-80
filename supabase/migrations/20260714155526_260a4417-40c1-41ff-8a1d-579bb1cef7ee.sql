-- DB-001.c.F2.slice-01: converter responsabilidades_patrimonios.patrimonio_id (text → uuid) + FK real
-- Pré-condição verificada: vw_db001_fronteira_orfaos retorna 0 linhas.

-- 1) Drop view (será recriada sem a linha desta coluna)
DROP VIEW IF EXISTS public.vw_db001_fronteira_orfaos;

-- 2) Remove CHECK de formato específico desta coluna
ALTER TABLE public.responsabilidades_patrimonios
  DROP CONSTRAINT IF EXISTS db001_responsabilidades_patrimonios_patrimonio_id_fmt;

-- 3) Converte tipo text → uuid
ALTER TABLE public.responsabilidades_patrimonios
  ALTER COLUMN patrimonio_id TYPE uuid USING patrimonio_id::uuid;

-- 4) Adiciona FK real (NOT VALID + VALIDATE em duas etapas para segurança operacional)
ALTER TABLE public.responsabilidades_patrimonios
  ADD CONSTRAINT fk_resp_pat_patrimonio
  FOREIGN KEY (patrimonio_id) REFERENCES public.patrimonios(id)
  ON UPDATE CASCADE ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.responsabilidades_patrimonios
  VALIDATE CONSTRAINT fk_resp_pat_patrimonio;

-- 5) Recria a view SEM a linha convertida
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
GROUP BY hs.colaborador_id;

GRANT SELECT ON public.vw_db001_fronteira_orfaos TO authenticated, service_role;