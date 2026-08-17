# 00 — LEIA PRIMEIRO

> **Destinatário: o executor da implementação (Lovable).** Este é o único documento que deve ser lido antes de qualquer outro. Sem ele, o pacote pode ser mal interpretado.

## Resumo Executivo

Você recebeu o resultado de 14 etapas de auditoria técnica: **107 Achados** com IDs permanentes, priorizados, sequenciados em **8 ondas**, com critérios de aceite verificáveis. O planejamento passou por um **Stage Gate formal** que autorizou o início — com limites explícitos.

## Objetivo

Ensinar a interpretar e usar o pacote sem reinterpretar a auditoria.

## Escopo

Ordem de leitura, regras invioláveis, uso do Contrato, do Plano Mestre, das Ondas e do Catálogo.

## Índice

1. [O que ler primeiro](#1-o-que-ler-primeiro)
2. [O que nunca pode ser ignorado](#2-o-que-nunca-pode-ser-ignorado)
3. [Como usar o Contrato de Execução](#3-como-usar-o-contrato-de-execução)
4. [Como usar o Plano Mestre](#4-como-usar-o-plano-mestre)
5. [Como usar as Ondas](#5-como-usar-as-ondas)
6. [Como usar o Catálogo Mestre](#6-como-usar-o-catálogo-mestre)
7. [Como interpretar o pacote](#7-como-interpretar-o-pacote)

## Conteúdo

### 1. O que ler primeiro

**Ordem obrigatória:**

1. **Este documento.**
2. **[04_CONTRATO_EXECUCAO.md](04_CONTRATO_EXECUCAO.md)** — as 7 restrições invioláveis.
3. **[05_STAGE_GATE_GO_NO_GO.md](05_STAGE_GATE_GO_NO_GO.md)** — o que está autorizado e o que está bloqueado.
4. **[03_PLANO_MESTRE_EXECUCAO.md](03_PLANO_MESTRE_EXECUCAO.md)** — como se executa.
5. **[../05_ONDAS/ONDA_00/README.md](../05_ONDAS/ONDA_00/README.md)** — a primeira onda.

Só depois, se precisar de contexto: [GOVERNANCA/01_AUDITORIA/](../../GOVERNANCA/01_AUDITORIA/).

### 2. O que nunca pode ser ignorado

| Regra                                                                      | Consequência de ignorar                             |
| -------------------------------------------------------------------------- | --------------------------------------------------- |
| **Toda unidade de trabalho referencia um ID do Catálogo**                  | Perda de rastreabilidade; trabalho sem ID não entra |
| **Nenhuma cirurgia de regressão Muito Alta sem caracterização E2E prévia** | Regressão silenciosa em produção                    |
| **As fusões obrigatórias são cirurgias únicas**                            | Retrabalho garantido                                |
| **A Execução não cria Achados**                                            | Escopo infla sem controle                           |
| **Ondas 2 e 6 estão bloqueadas** até suas condições                        | Retrabalho e risco crítico                          |
| **As 6 decisões (D-1..D-6) pertencem ao dono do produto**                  | Decisão arquitetural usurpada                       |

### 3. Como usar o Contrato de Execução

O Contrato lista **o que não pode mudar**: IDs, prioridades, diagnósticos, critérios de aceite, e as fusões obrigatórias. Antes de iniciar qualquer Achado, confirme que sua abordagem não viola nenhuma das 7 restrições. Se violar, **pare e registre um desvio** — não prossiga.

### 4. Como usar o Plano Mestre

O Plano Mestre define **como** se executa: branch por onda e por ID, tag por marco, CI como gate, registro de desvios, documentação como subproduto. Ele responde "de que forma", enquanto as Ondas respondem "o quê".

### 5. Como usar as Ondas

Cada pasta `ONDA_0N/` é um **dossiê autossuficiente** com 11 documentos. Fluxo dentro da onda:

```
README (contexto) → Escopo → Achados → Dependencias → Criticidade
   → Criterios_Aceite → Plano_Execucao → [EXECUTAR]
   → Plano_Regressao → Checklist_Conclusao → aprovação
```

**Nenhuma onda inicia sem a aprovação formal da anterior** quando houver dependência declarada.

### 6. Como usar o Catálogo Mestre

O [Catálogo Mestre](../02_CATALOGO/Catalogo_Mestre.md) é a **fonte única de verdade** dos 107 Achados. Cada linha traz ID, categoria, prioridade, complexidade, criticidade, tipo, estratégia, dependências, onda e etapa de origem.

- A **ficha completa** (evidências, diagnóstico, critérios de aceite) está na **etapa de origem**, em [GOVERNANCA/01_AUDITORIA/](../../GOVERNANCA/01_AUDITORIA/).
- Recortes alternativos: [por Prioridade](../02_CATALOGO/Achados_por_Prioridade.md) · [por Categoria](../02_CATALOGO/Achados_por_Categoria.md) · [por Módulo](../02_CATALOGO/Achados_por_Modulo.md) · [por Onda](../02_CATALOGO/Achados_por_Onda.md).

### 7. Como interpretar o pacote

Três princípios que atravessam toda a auditoria:

1. **O Planifik não precisa de reescrita.** A maioria dos Achados consiste em _terminar de aplicar padrões que o próprio projeto já criou_ (repositories documentados mas não usados; QueryState pronto mas subadotado; Sentry desenhado mas desligado).
2. **A causa-raiz recorrente é a fronteira dupla de backend** (PHP legado ↔ Supabase). Ela explica achados de arquitetura, estado, dados, segurança e testes.
3. **A auditoria não usurpou decisões de negócio.** Onde uma escolha pertencia ao dono do produto, ela foi registrada como decisão pendente — não como solução imposta.

### Cisões de execução (não são novos Achados)

Três Achados foram cindidos pelo Stage Gate para resolver inversões de ordem:

| Achado  | Parte A                                                      | Parte B                                                                   |
| ------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| OPS-001 | OPS-001.a — CI com install+build+test (Onda 0)               | OPS-001.b — CI acrescido de lint+typecheck (Onda 1, após QC-001/QC-002)   |
| TST-001 | TST-001.a — E2E de caracterização no estado atual (Onda 0)   | TST-001.b — E2E consolidado ao novo login/escopo (Onda 2/3)               |
| OPS-006 | OPS-006.a — Backup do MySQL verificado e restaurado (Onda 0) | OPS-006.b — Rollback coordenado front↔schema (Onda 3, após DB-003/DB-004) |

## Conclusão

Se você leu até aqui, já sabe o suficiente para começar pela **Onda 0**. Ela contém as ações de menor risco e maior retorno do programa inteiro — e tira o sistema da zona de exposição material.

## Referências

- [Contrato de Execução](04_CONTRATO_EXECUCAO.md) · [Stage Gate](05_STAGE_GATE_GO_NO_GO.md) · [Plano Mestre](03_PLANO_MESTRE_EXECUCAO.md) · [Onda 0](../05_ONDAS/ONDA_00/README.md) · [Catálogo Mestre](../02_CATALOGO/Catalogo_Mestre.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
