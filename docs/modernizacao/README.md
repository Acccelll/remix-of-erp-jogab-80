# Pacote Oficial de Governança da Modernização — Planifik

> **Documentação oficial da modernização.** Produto de 14 etapas de Auditoria Técnica (Etapas 1–14.5), consolidadas em um Catálogo Mestre de **107 Achados** e um programa de execução em **8 ondas**.

## Resumo Executivo

Este pacote reúne, em um único lugar, tudo o que foi diagnosticado, priorizado e planejado para a modernização do Planifik — um ERP de construção e montagem industrial (React + TypeScript + Supabase, com backend PHP legado). Ele está dividido em duas áreas com propósitos distintos: **GOVERNANCA** (memória permanente da auditoria) e **EXECUCAO** (o que o executor usa no dia a dia).

## Objetivo

Permitir que a implementação seja executada integralmente **sem reinterpretar a auditoria**, preservando rastreabilidade total entre diagnóstico e entrega.

## Escopo

- **107 Achados** — P0: 4 · P1: 42 · P2: 38 · P3: 23
- **8 Ondas** de execução (Onda 0 a Onda 7)
- **6 Decisões pendentes** que pertencem ao dono do produto
- **Veredito do Stage Gate:** `GO` condicional (Ondas 0 e 1 autorizadas)

## Estrutura de Diretórios

```
Modernizacao_Projeto/
├── README.md                    (este arquivo)
├── GOVERNANCA/                  documentação permanente — consulta e histórico
│   ├── 00_EXECUTIVO/            visão geral e roadmap
│   ├── 01_AUDITORIA/            as 16 etapas completas, íntegras
│   ├── 06_REFERENCIA/           glossário, convenções, taxonomias
│   └── 07_ANEXOS/
└── EXECUCAO/                    documentação operacional — uso diário do Lovable
    ├── 00_EXECUTIVO/            LEIA PRIMEIRO, contrato, plano mestre, gate
    ├── 02_CATALOGO/             os 107 Achados em 5 recortes
    ├── 03_IMPLEMENTACAO/        5 matrizes (.xlsx)
    ├── 04_VALIDACAO/            regressão, plano de validação, checklist final
    └── 05_ONDAS/                8 dossiês completos (ONDA_00 a ONDA_07)
```

## Como Utilizar

1. Leia **[EXECUCAO/00_EXECUTIVO/00_LEIA_PRIMEIRO.md](EXECUCAO/00_EXECUTIVO/00_LEIA_PRIMEIRO.md)** — é o ponto de entrada obrigatório.
2. Aceite o **[Contrato de Execução](EXECUCAO/00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)** — define o que não pode ser alterado.
3. Confirme o veredito no **[Stage Gate](EXECUCAO/00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)**.
4. Abra o dossiê da onda corrente em **[EXECUCAO/05_ONDAS/](EXECUCAO/05_ONDAS/)** e execute achado a achado.
5. Ao fim da onda, aplique o **Checklist de Conclusão** da própria onda.

## Fluxo Recomendado

```
LEIA_PRIMEIRO → Contrato → Stage Gate → Plano Mestre → Dossiê da Onda N
     → executar Achado a Achado → Plano de Regressão da Onda
     → Checklist de Conclusão → aprovação → Onda N+1
```

## Diferença entre Auditoria e Execução

|                | Auditoria (GOVERNANCA)                 | Execução (EXECUCAO)          |
| -------------- | -------------------------------------- | ---------------------------- |
| **Natureza**   | Diagnóstico. Fechado.                  | Operação. Vivo.              |
| **Alterável?** | Não. É registro histórico.             | Sim, por registro de desvio. |
| **Quem usa**   | Arquiteto, auditor, novos mantenedores | Executor (Lovable)           |
| **Produz**     | Achados                                | Entregas                     |

**Regra de ouro:** a Execução **nunca** cria Achados. Descobertas durante a implementação viram _Descobertas de Execução_ (D-xx) no registro de desvios e são avaliadas ao fim da onda.

## Como Localizar…

- **…um Achado:** pelo ID em [02_CATALOGO/Catalogo_Mestre.md](EXECUCAO/02_CATALOGO/Catalogo_Mestre.md). A ficha completa está na etapa de origem, em [GOVERNANCA/01_AUDITORIA/](GOVERNANCA/01_AUDITORIA/).
- **…uma Onda:** em [EXECUCAO/05_ONDAS/ONDA_0N/README.md](EXECUCAO/05_ONDAS/).
- **…um Critério de Aceite:** no `Criterios_Aceite.md` da onda, ou na ficha original do Achado (etapa de origem).
- **…um Fluxo de Regressão:** em [04_VALIDACAO/Matriz_Regressao.xlsx](EXECUCAO/04_VALIDACAO/) e no `Plano_Regressao.md` de cada onda.

## Conclusão

O Planifik é um produto funcionalmente forte, travado por dívidas **concentradas e endereçáveis**. Este pacote transforma 14 etapas de diagnóstico em um caminho de execução verificável, onda a onda.

## Referências

- [Visão Geral](GOVERNANCA/00_EXECUTIVO/01_VISAO_GERAL.md) · [Roadmap](GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md) · [Plano Mestre](EXECUCAO/00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md) · [Glossário](GOVERNANCA/06_REFERENCIA/Glossario.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
