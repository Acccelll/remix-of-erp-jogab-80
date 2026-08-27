-- Limpeza de schema morto (system design §4.2): 15 tabelas + 1 função Postgres
-- cujo domínio (Colaborador/DP/Ponto/Frotas/Patrimônios) já fechou e roda 100%
-- em MySQL via api.php, sem nenhum caminho de escrita Postgres restante
-- (confirmado por grep: zero INSERT/UPDATE nas migrations e zero
-- `.from("<tabela>")` no frontend). Ver docs/db/CANONICIDADE.md — nota
-- "Colaborador" já documenta que o domínio roda no MySQL e que as tabelas
-- espelho Postgres não devem ganhar novos leitores.
--
-- Pré-requisito descoberto na investigação: 3 tabelas VIVAS têm FK apontando
-- para dentro deste conjunto morto (colaboradores/patrimonios/players).
-- Nenhuma delas é uma dualidade real — são referências soltas que, no
-- desenho atual do projeto, cruzam a fronteira Postgres/MySQL sem FK
-- declarada (mesmo padrão já aceito para Cliente, ver CANONICIDADE.md). Por
-- isso essas FKs são soltas aqui, não as tabelas donas:
--   - rdo_efetivo.colaborador_id       (RDO é módulo ativo; a lista de
--     colaboradores já vem do MySQL via rota `mobilizacoesPeriodos` — a FK
--     para a tabela congelada só arriscava falha ao marcar presença de
--     colaborador contratado após o congelamento)
--   - responsabilidades_patrimonios.colaborador_id / .patrimonio_id (tabela
--     em si já é morta — zero uso no frontend, espelho de `case
--     'responsabilidades'` no api.php — mas fica fora deste corte por ora)
--   - custo_colaborador_competencia.colaborador_id (tabela nunca recebeu
--     escrita; alimenta hoje 2 hooks que sempre retornam vazio — achado
--     registrado para investigação futura, fora do escopo deste corte)
-- e leads.prospectado_por → players (coluna sem nenhum uso no frontend).

-- 1) Solta as FKs vindas de tabelas vivas para dentro do conjunto morto.
DO $$
DECLARE con text;
BEGIN
  SELECT conname INTO con FROM pg_constraint
    WHERE conrelid = 'public.rdo_efetivo'::regclass
      AND confrelid = 'public.colaboradores'::regclass AND contype = 'f';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.rdo_efetivo DROP CONSTRAINT %I', con);
  END IF;

  SELECT conname INTO con FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND confrelid = 'public.players'::regclass AND contype = 'f';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', con);
  END IF;
END $$;

ALTER TABLE public.responsabilidades_patrimonios
  DROP CONSTRAINT IF EXISTS fk_resp_pat_colaborador,
  DROP CONSTRAINT IF EXISTS fk_resp_pat_patrimonio;

ALTER TABLE public.custo_colaborador_competencia
  DROP CONSTRAINT IF EXISTS fk_custo_colab_colaborador;

-- 2) `vw_homem_hora_mensal` não tem nenhum consumidor no frontend — cai.
DROP VIEW IF EXISTS public.vw_homem_hora_mensal;

-- 3) `vw_cutover_metrics_ponto` é lida por GMCutoverIndex/GMCutover (painel
-- de cutover). Já refletia dado morto (ponto fechou pro MySQL há tempo);
-- vira um stub vazio no mesmo idioma já usado em `vw_db001_fronteira_orfaos`
-- em vez de quebrar a query do frontend.
CREATE OR REPLACE VIEW public.vw_cutover_metrics_ponto AS
SELECT
  NULL::uuid AS obra_id,
  0::bigint AS colaboradores_distintos,
  0::bigint AS registros_total,
  0::bigint AS registros_30d,
  NULL::date AS ultimo_registro,
  0::bigint AS tratativas,
  0::bigint AS invalidas
WHERE FALSE;
GRANT SELECT ON public.vw_cutover_metrics_ponto TO authenticated, service_role;

-- 4) Derruba as tabelas mortas (filhas antes das mães, dentro do próprio
-- conjunto — CASCADE não é necessário pois as únicas FKs externas já foram
-- soltas acima).
DROP TABLE IF EXISTS public.ponto_tratativas;
DROP TABLE IF EXISTS public.ponto_registros;
DROP TABLE IF EXISTS public.ponto_importacoes;
DROP TABLE IF EXISTS public.mobilizacoes_periodos;
DROP TABLE IF EXISTS public.mobilizacoes_veiculos;
DROP TABLE IF EXISTS public.decimo_terceiro;
DROP TABLE IF EXISTS public.dp_holerite;
DROP TABLE IF EXISTS public.fopag_entries;
DROP TABLE IF EXISTS public.historico_salarial;
DROP TABLE IF EXISTS public.horas_extras;
DROP TABLE IF EXISTS public.provisoes;
DROP TABLE IF EXISTS public.patrimonios;
DROP TABLE IF EXISTS public.veiculos;
DROP TABLE IF EXISTS public.colaboradores;
DROP TABLE IF EXISTS public.players;

-- 5) RPC morta (folha rateada por colaborador/obra) — sem consumidor no
-- frontend, dependia de `colaboradores`/`historico_salarial`, já removidas.
DROP FUNCTION IF EXISTS public.get_folha_rateada(text, text);
