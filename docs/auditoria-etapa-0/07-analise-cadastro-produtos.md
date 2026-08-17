# 07 — Análise da planilha "Banco de Dados - JOGAB" (arquivo real recebido)

> **ATUALIZADO (31/07/2026).** A planilha foi disponibilizada. **Constatação inicial e importante:
> o arquivo NÃO é um cadastro de produtos/insumos** — é uma **base de RH, folha e custo de mão de
> obra**. O escopo original deste documento ("cadastro de produtos") não se aplica ao arquivo
> entregue. A análise abaixo descreve o que o arquivo realmente contém e onde ele se encaixa no ERP.
>
> A análise do cadastro de insumos já existente no ERP permanece na seção 4.

---

## 1. Estrutura real do arquivo (XLSX, 265 KB, 6 abas)

| Aba | Linhas × Colunas | Conteúdo |
|---|---|---|
| `CARGOS` | 30 × 18 | Tabela de cargos com nº de funcionários, massa salarial e **médias salariais por hora/dia/semana/mês**, em 3 variantes (real, arredondada, orçamento) |
| `Orçamento M.O.` | 38 × 52 | Modelo de **custo de mão de obra por item de serviço**: qtd. de cálculo, unidade, e uma coluna por cargo (~48 cargos) |
| `GERAL` | 535 × 43 | **Tabela dinâmica** — soma de pagamentos por funcionário × mês (JAN–DEZ + Total Geral) |
| `DIVERGENCIAS` | 245 × 9 | Três listas nominais confrontadas (Copatto / Gui / Gilson) — **reconciliação manual de cadastro de pessoal** |
| `Planilha2` | 171 × 4 | Consolidação por funcionário (2 origens + total) |
| `RH` | 2.441 × 12 | **Base transacional**: Funcionário, Valor pagamento, Cesta + Outros, Total, BANCO (PIX/CAIXA), Referente (Vale/Salário), Área, Mês |

**Parâmetros de cálculo encontrados em `CARGOS`:** 8,8 h/dia · 44 h/semana · 220 h/mês.
**Parâmetros em `Orçamento M.O.`:** 36 h extras/colaborador · 60% de adicional de hora extra ·
220 h/mês. Fórmula observada: `salário/hora = salário mês / 220`;
`hora extra = salário/hora × 1,6`; `custo mensal = salário + (HE × horas extras)`.

---

## 2. O que isso significa para o projeto

1. **Não existe, hoje, no ERP, módulo que consuma esta planilha.** O `RH` do ERP cobre colaboradores
   e histórico, mas **não há motor de custo de mão de obra por cargo** nem composição de orçamento
   de M.O. por serviço. Esta planilha é a **especificação funcional** desse motor, ainda inexistente.
2. **A aba `Orçamento M.O.` é o elo faltante entre RH e Orçamento**: ela precifica um item de serviço
   pela composição de cargos × horas — o mesmo papel que `Composicao`/`CompItem` fazem hoje só para
   **insumos materiais**. O modelo do ERP precisa de um segundo tipo de item de composição
   (`tipo = 'mao_de_obra'`, referenciando **cargo**, não insumo).
3. **A aba `DIVERGENCIAS` é um sintoma grave**: três listas de pessoal em conflito (nomes com
   grafias/capitalizações diferentes, ex.: `Adao Macedo` vs `ADAO MACEDO`). Confirma que **a fonte
   da verdade de colaboradores está fora do ERP** e é reconciliada à mão. Migrar isso para
   `colaboradores` com chave estável (CPF/matrícula) deveria ser prioridade da Etapa 0.5.
4. **A aba `RH` (2.441 lançamentos)** é uma base transacional real, migrável: mapeia bem para uma
   tabela `rh_pagamentos` (`colaborador_id`, `competencia_mes`, `tipo` [Vale|Salário],
   `valor_pagamento`, `valor_beneficios`, `banco`, `area`).
5. **Sem chave primária confiável**: todas as abas referenciam pessoas por **nome livre**. Nenhuma
   coluna de CPF, matrícula ou ID. Qualquer importação exigirá etapa de *matching* assistido.

---

## 3. Recomendação de encaixe (proposta, não implementada)

| Aba | Destino sugerido | Etapa |
|---|---|---|
| `CARGOS` | tabela `cargos` (+ `custo_hora`, `custo_hora_orcamento`) | 0.5 |
| `RH` | `rh_pagamentos` + vínculo com `colaboradores` | 0.5 |
| `DIVERGENCIAS` | não migrar — resolver na origem antes de importar | 0.5 (pré-req.) |
| `GERAL` / `Planilha2` | não migrar — são views; reconstruir como relatório | 1+ |
| `Orçamento M.O.` | novo motor de composição de M.O. no Orçamento | 2 |

---

## 4. Cadastro de insumos existente no ERP (mantido da versão anterior)

**Tabela `insumos`** (migration `20260625123216_...`), acessada exclusivamente via `insumosRepo`
(`src/lib/repositories/insumos.ts`, marcado `@internal ARC-012` — acesso público só pelos hooks em
`@/hooks/useInsumos`).

Campos: `id`, `codigo`, `descricao`, `tipo`, `unidade`, `preco_unitario`, `fonte`,
`referencia_externa`, `ativo`, `created_at`, `updated_at`.

**Validação (Zod, `src/lib/schemas/insumo.ts`)**: `descricao` obrigatória (máx. 300);
`codigo` opcional (máx. 40, **sem regra de unicidade**); `unidade` obrigatória, restrita a allowlist
*hardcoded* de 13 valores (`un, pc, kg, g, t, m, m2, m3, l, ml, h, cx, vb`);
`preco_unitario` opcional e não negativo. **Não há categoria/família de insumo.**

**Telas/hooks**: `src/pages/suprimentos/Insumos.tsx`; hooks `useInsumosCompleto`,
`useInsumosAtivosBasico`, `useInsumosPrecos`, `useCreateInsumo`, `useUpdateInsumo`,
`useToggleInsumoAtivo`.

**Downstream**: alimenta `Composicao`/`CompItem` (Orçamento) e a curva ABC
(`src/lib/estoque/curva-abc-insumos.ts`). Erro de cadastro se propaga para orçamento e estoque.

**Confronto com o quadro Trello (doc 06):** os itens de checklist reais
(`3292pç - BLOCO DE CONCRETO 19X19X39`) usam a unidade **`pç`**, que **não está na allowlist**
(a lista tem `pc`, sem cedilha). A importação de material do Trello falharia na validação de unidade.
**Normalizar acentuação/cedilha na função de unidade é pré-requisito da Etapa 1.**

---

## 5. Pendência

A planilha de **cadastro de produtos/insumos** propriamente dita (se existir) continua não
disponibilizada. O arquivo recebido cobre RH/custo de M.O. Caso exista uma segunda planilha de
produtos, este documento deve ganhar uma seção 6.
