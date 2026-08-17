# Onda 6 — Achados

## Resumo Executivo

Os **8 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 6. Nenhum outro.

## Conteúdo

| ID           | Título                                                                      | Prior. | Compl.     | Crit. | Tipo | Estratégia | Dependências              | Módulo          | Origem                                                                         |
| ------------ | --------------------------------------------------------------------------- | ------ | ---------- | ----- | ---- | ---------- | ------------------------- | --------------- | ------------------------------------------------------------------------------ |
| **ARC-002**  | God-context AppContext (730L, 63 membros, 86 consumidores)                  | P1     | Muito Alta | C1    | REF  | MIGRAÇÃO   | ARC-001, TST-001, TST-002 | Transversal     | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| **ARC-004**  | Duas máquinas de estado servidor (imperativa PHP x TanStack Query)          | P1     | Alta       | C1    | REF  | MIGRAÇÃO   | ARC-002                   | Transversal     | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| **ARC-005**  | Monólitos página/diálogo (10 arquivos de 700 a 2.104 linhas)                | P1     | Alta       | C1    | REF  | SEQUENCIAL | ARC-001, ARC-003          | M2, M3          | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md) |
| **PERF-001** | Chunks-gigante: entry 789kB, CardGenericoDialog 791kB, FinObraDetalhe 674kB | P1     | Média      | C1    | REF  | SEQUENCIAL | ARC-005                   | M2, M3          | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)           |
| **PRO-004**  | DP: dualidade legado/novo (provisões, HE, histórico, fopag em 2 bancos)     | P1     | Alta       | C1    | MIG  | MIGRAÇÃO   | ARC-004, DB-005           | M9              | [Etapa 1,2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md) |
| **PERF-003** | Granularidade de render inexistente (React.memo usado 2x)                   | P2     | Média      | C2    | REF  | LOTE       | ARC-005, DS-011           | M1, M2, M7, M11 | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)           |
| **DS-011**   | 6 implementações independentes de Kanban                                    | P3     | Alta       | C2    | REF  | SEQUENCIAL | ARC-005                   | M1, M2, M7, M11 | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)          |
| **DS-016**   | 31 diálogos de domínio autofetchantes (UI acoplada a dados)                 | P3     | Alta       | C2    | REF  | SEQUENCIAL | ARC-003, ARC-005          | Transversal     | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)          |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 8 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
