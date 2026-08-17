# Onda 0 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C0**: 2 · **C1**: 4 · **C2**: 2.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C0 — 2 achado(s)

| ID        | Título                                                                   | Prioridade | Módulo         |
| --------- | ------------------------------------------------------------------------ | ---------- | -------------- |
| `SEC-003` | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto | P0         | Plataforma     |
| `TST-001` | Ausência de testes E2E dos fluxos críticos de negócio                    | P1         | M1, M5, M7, M8 |

### C1 — 4 achado(s)

| ID        | Título                                                         | Prioridade | Módulo      |
| --------- | -------------------------------------------------------------- | ---------- | ----------- |
| `EST-002` | Escopo multiempresa não flui para os dados (filtro não filtra) | P1         | Transversal |
| `OPS-001` | Ausência de CI (gate de qualidade antes do deploy)             | P1         | Plataforma  |
| `OPS-002` | Error tracking desligado na prática (Sentry não instalado)     | P1         | Plataforma  |
| `OPS-006` | Backup do host MySQL e rollback de schema não evidenciados     | P1         | Plataforma  |

### C2 — 2 achado(s)

| ID        | Título                                                    | Prioridade | Módulo      |
| --------- | --------------------------------------------------------- | ---------- | ----------- |
| `UX-004`  | Escopo multiempresa silencioso (sem sinalização por tela) | P1         | Transversal |
| `TST-004` | Ausência de medição de cobertura                          | P2         | Transversal |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Esta onda contém Achados C0 — nenhum deles pode ser executado sem rede de testes.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
