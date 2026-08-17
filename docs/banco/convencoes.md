# Convenções de banco (Postgres/Supabase)

> **DB-006** — Convenção única prospectiva. Vale para **objetos novos**.
> Nomes históricos fora do padrão são **legado aceito** e não devem ser
> renomeados em massa (custo de migração > benefício de uniformidade).

## 1. Regras rápidas (checklist para PR de migration)

- [ ] Tabelas, colunas, índices, funções e triggers em **`snake_case` português-BR**.
- [ ] Sem prefixo de domínio no nome da tabela (`obras`, não `obra_obras`).
- [ ] Enums novos usam **`CREATE TYPE ... AS ENUM`** — evitar `text + CHECK` para valores fixos.
- [ ] Toda tabela `public.*` tem `GRANT` explícito (regra do Data API) e `ENABLE ROW LEVEL SECURITY`.
- [ ] Coluna de timestamp usa `timestamptz DEFAULT now()`; nunca `timestamp` sem timezone.
- [ ] `updated_at` obrigatório em tabelas mutáveis, com trigger `trg_touch_updated_at`.
- [ ] Funções auxiliares privadas prefixadas com `_` (ex.: `_valida_cpf`).
- [ ] Funções de RLS usam padrão `has_role(auth.uid(), 'admin')` — nunca ler `user_roles` diretamente na policy.

## 2. Nomenclatura

### 2.1 Objetos

| Objeto            | Convenção                              | Exemplo                                  |
| ----------------- | -------------------------------------- | ---------------------------------------- |
| Tabela            | `snake_case`, plural, pt-BR            | `colaboradores`, `ordens_compra`         |
| Coluna            | `snake_case`, singular, pt-BR          | `data_admissao`, `obra_id`               |
| FK                | `<tabela_alvo_singular>_id`            | `obra_id`, `colaborador_id`              |
| Índice            | `ix_<tabela>__<colunas>`               | `ix_medicoes__obra_id__data`             |
| Índice único      | `uq_<tabela>__<colunas>`               | `uq_colaboradores__cpf`                  |
| Constraint CHECK  | `ck_<tabela>__<intencao>`              | `ck_medicoes__percentual_0_100`          |
| PK                | `pk_<tabela>` (default do Postgres OK) | —                                        |
| Enum              | `<dominio>_<atributo>` singular        | `risco_severidade`, `oc_status`          |
| Função pública    | verbo em pt-BR                         | `calcular_saldo_obra(...)`               |
| Função privada    | prefixo `_`                            | `_valida_cnpj(...)`                      |
| Função de RLS     | `has_role`, `pode_ver_*`               | `has_role(uuid, app_role)`               |
| Trigger           | `trg_<tabela>__<evento>_<acao>`        | `trg_obras__before_update__touch`        |
| View              | `vw_<intencao>`                        | `vw_saldo_obras`                         |
| Materialized view | `mv_<intencao>`                        | `mv_curva_s`                             |

### 2.2 O que **não** fazer

- Misturar inglês e português no mesmo objeto (`fn_getSaldo` ❌).
- Prefixos de domínio na tabela (`obra_medicoes` ❌ → `medicoes` ✅).
- Prefixos de estilo inconsistente (`fn_`, `_privada`, sem prefixo — escolher segundo a tabela 2.1).
- `text + CHECK IN (...)` para valores fixos: usar `ENUM`. Exceção: valores voláteis definidos por usuário.

## 3. Tipos

| Domínio                  | Tipo canônico                          | Nota                                                     |
| ------------------------ | -------------------------------------- | -------------------------------------------------------- |
| Chave primária           | `uuid DEFAULT gen_random_uuid()`       | Nada de `serial` em tabelas novas.                       |
| Data/hora                | `timestamptz`                          | Sempre com timezone. Renderização é problema do cliente. |
| Data pura                | `date`                                 | Ex.: `data_admissao`.                                    |
| Moeda                    | `numeric(14,2)`                        | Nunca `float`/`real` para dinheiro.                      |
| Percentual (0–100)       | `numeric(5,2)` + `CHECK (>=0 AND <=100)` |                                                        |
| Texto curto              | `text`                                 | Sem `varchar(n)` — `CHECK (length(...))` se necessário.  |
| Booleano                 | `boolean DEFAULT false`                | Nome afirmativo: `ativo`, não `inativo`.                 |
| JSON                     | `jsonb`                                | Nunca `json`.                                            |

## 4. Segurança (recorte da regra global)

Toda tabela em `public` numa migration nova segue **exatamente** esta ordem:

```sql
CREATE TABLE public.<t> (...);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
-- GRANT SELECT ON public.<t> TO anon; -- só se houver policy que permita anon
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... ;
```

Roles do usuário: sempre em tabela separada (`user_roles` + `has_role`) — nunca em `profiles`.

## 5. Migrations

- Nome do arquivo: timestamp da plataforma + verbo curto (`create_ordens_compra`, `add_ck_medicoes_percentual`).
- Uma migration deve ser **reversível mentalmente** — comentário no topo explicando "o quê" e "por quê" (não "como", que o SQL já diz).
- Não misturar DDL de tabelas diferentes com data-fix na mesma migration, salvo quando o data-fix for pré-requisito do DDL.

## 6. Legado aceito (não corrigir sem plano)

Objetos históricos que violam esta convenção **ficam como estão** salvo migração planejada. Exemplos frequentes: mistura pt/en em funções antigas, `text+CHECK` de enums pré-existentes, ausência de `trg_touch_updated_at` em tabelas raramente escritas.

Registre exceções relevantes na revisão de PR — este documento é a base de comparação.

## 7. Revisão de PR

O revisor deve marcar o checklist da seção 1 antes de aprovar qualquer migration nova. PR que introduza objeto público sem `GRANT` ou sem `ENABLE ROW LEVEL SECURITY` é bloqueado.

## 8. Referências

- Contrato de execução do programa — `docs/modernizacao/EXECUCAO/00_EXECUTIVO/04_CONTRATO_EXECUCAO.md`
- Etapa 8 — [Arquitetura de Dados](../modernizacao/GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)
- Regras globais do projeto para grants em `public` e user roles (memória do agente).
