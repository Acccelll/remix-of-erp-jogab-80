# Onda 6 — Escopo

## Resumo Executivo

Aposentar o legado, quebrar monólitos e granular render. Esta onda contém **8 Achados** e tem esforço relativo **Muito Grande**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID           | Título                                                                      | Categoria     |
| ------------ | --------------------------------------------------------------------------- | ------------- |
| **ARC-002**  | God-context AppContext (730L, 63 membros, 86 consumidores)                  | Arquitetura   |
| **ARC-004**  | Duas máquinas de estado servidor (imperativa PHP x TanStack Query)          | Arquitetura   |
| **ARC-005**  | Monólitos página/diálogo (10 arquivos de 700 a 2.104 linhas)                | Arquitetura   |
| **PERF-001** | Chunks-gigante: entry 789kB, CardGenericoDialog 791kB, FinObraDetalhe 674kB | Performance   |
| **PRO-004**  | DP: dualidade legado/novo (provisões, HE, histórico, fopag em 2 bancos)     | Produto       |
| **PERF-003** | Granularidade de render inexistente (React.memo usado 2x)                   | Performance   |
| **DS-011**   | 6 implementações independentes de Kanban                                    | Design System |
| **DS-016**   | 31 diálogos de domínio autofetchantes (UI acoplada a dados)                 | Design System |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Ondas 1, 2 e 3 aprovadas **+ TST-001.b e TST-002 verdes + decisão D-3 registrada**.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 8 Achados, marco **M7**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
