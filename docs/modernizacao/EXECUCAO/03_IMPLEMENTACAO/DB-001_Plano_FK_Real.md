# DB-001 — Plano faseado de conversão para FK real

**Onda:** 3  
**Achado:** DB-001  
**Escopo:** colunas de fronteira em `text` que referenciam entidades ainda hospedadas no backend legado (PHP/MySQL) ou já espelhadas no Supabase.

## Princípio

A conversão de coluna `text` para FK real (`uuid REFERENCES ...`) só é feita **depois** que a entidade referenciada estiver canonicamente no Supabase, com backfill 1:1 concluído e escrita cortada do trilho legado. Enquanto isso, a integridade é garantida por:

1. `CHECK` de formato via `public.db001_legacy_id_is_valid(text)` (DB-001.a).
2. Relatório de órfãos `public.vw_db001_fronteira_orfaos` mantido em zero (DB-001.a).
3. Gate de regressão em CI que falha o build se algum órfão surgir (DB-001.b).

## Fases

| Fase | Entidade canônica | Colunas de fronteira | Pré-condição para FK | Onda alvo |
| --- | --- | --- | --- | --- |
| F1 | `colaboradores` | `mobilizacoes_periodos.colaborador_id`, `responsabilidades_patrimonios.colaborador_id`, `dp_holerite.colaborador_id`, `fopag_entries.colaborador_id`, `historico_salarial.colaborador_id`, `provisoes.colaborador_id`, `decimo_terceiro.colaborador_id`, `horas_extras.colaborador_id`, `custo_colaborador_competencia.colaborador_id` | Tabela `public.colaboradores` como fonte única + escrita legada desligada | Onda 5 |
| F2 | `patrimonios` | `responsabilidades_patrimonios.patrimonio_id` | Migração de patrimônios para Supabase | Onda 5 |
| F3 | `veiculos` | `mobilizacoes_veiculos.veiculo_id` | Migração de frotas para Supabase | Onda 5 |
| F4 | `obras` (já canônica) | `controle_despesas.obra_id`, `solicitacoes_financeiras.obra_id` | Auditoria de correspondência 1:1 dos ids atuais | Onda 4 |

Cada fase é um changeset próprio `DB-001.c.<n>` que:

1. Faz `UPDATE` normalizando ids para `uuid`.
2. Adiciona coluna `<col>_uuid uuid` populada.
3. Cria FK `NOT VALID`, roda `VALIDATE CONSTRAINT`.
4. Renomeia colunas e remove o `CHECK` de formato correspondente.
5. Remove a linha do `vw_db001_fronteira_orfaos` (agregação).

## Gate de regressão (DB-001.b)

- Script `scripts/verify-db001-orfaos.sh` consulta `vw_db001_fronteira_orfaos` via `psql` quando `DATABASE_URL` está presente e falha com exit 1 se `total_orfaos > 0`.
- No CI, executado apenas em jobs com credenciais do banco de staging; em PRs sem credenciais o passo é `skipped` (não bloqueia mas registra aviso).
- Localmente: `bun run verify:db001-orfaos`.

## Não-objetivo

- Não converter para FK enquanto a entidade referenciada não for canônica no Supabase — o `CHECK` de formato e o relatório de órfãos são suficientes durante a fronteira.
