# Onda 4 — Achados

## Resumo Executivo

Os **16 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 4. Nenhum outro.

## Conteúdo

| ID           | Título                                                                  | Prior. | Compl. | Crit. | Tipo | Estratégia | Dependências    | Módulo         | Origem                                                                           |
| ------------ | ----------------------------------------------------------------------- | ------ | ------ | ----- | ---- | ---------- | --------------- | -------------- | -------------------------------------------------------------------------------- |
| **DS-002**   | Dois sistemas de toast (sonner x84 / use-toast x9)                      | P1     | Baixa  | C2    | STD  | ISOLADA    | —               | Transversal    | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| **DS-006**   | Moeda sem fonte única (BRL inline em 32 páginas; money x currency)      | P1     | Baixa  | C1    | STD  | ISOLADA    | —               | Transversal    | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| **DS-010**   | Paginação inexistente como padrão (primitivo pronto, 2 usos)            | P1     | Média  | C2    | STD  | LOTE       | ARC-003         | M2, M3, M8     | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| **PERF-002** | Consultas de lista sem limite e sem projeção (24 select(*), 31 limit)   | P1     | Média  | C2    | STD  | LOTE       | DS-010, ARC-003 | M2, M3, M8, M9 | [Etapa 10](../../../GOVERNANCA/01_AUDITORIA/ETAPA_10_PERFORMANCE.md)             |
| **QC-003**   | Tratamento de erros sem política única (4 destinos; 15 catch vazios)    | P1     | Média  | C1    | STD  | LOTE       | DS-002          | Transversal    | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |
| **UX-001**   | Telas sem porta (Suprimentos estruturante) e configurações fragmentadas | P1     | Média  | C1    | MOD  | ISOLADA    | —               | M7             | [Etapa 1,2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md) |
| **BIZ-004**  | Datas sem módulo central (48 arquivos formatam inline)                  | P2     | Baixa  | C2    | STD  | ISOLADA    | —               | Transversal    | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)           |
| **DS-003**   | window.confirm nativo em 5 telas                                        | P2     | Baixa  | C2    | STD  | ISOLADA    | —               | Transversal    | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| **DS-004**   | Subadoção de QueryState/EmptyState (spinner manual em 31 páginas)       | P2     | Média  | C2    | REF  | LOTE       | DS-002          | Transversal    | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)           |
| **DS-005**   | Mapas status->rótulo/cor duplicados em 15 arquivos                      | P2     | Baixa  | C2    | STD  | ISOLADA    | —               | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **DS-007**   | KPI/StatCard reimplementado por dashboard                               | P2     | Média  | C2    | REF  | LOTE       | —               | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **DS-008**   | Recharts cru em 24 arquivos; ui/chart.tsx com 0 usos                    | P2     | Média  | C2    | REF  | LOTE       | DS-007          | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **DS-009**   | 24 de 28 telas com tabela crua fora de ui/data-table                    | P2     | Alta   | C2    | REF  | LOTE       | DS-004, DS-010  | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **DS-014**   | Biblioteca sem catálogo/documentação                                    | P2     | Baixa  | C2    | DOC  | ISOLADA    | —               | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **DS-012**   | 8 diálogos de importação repetindo a mesma casca                        | P3     | Média  | C3    | REF  | LOTE       | —               | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **DS-015**   | Sem escala de tamanhos de Dialog; sem barra de filtros padrão           | P3     | Baixa  | C3    | STD  | ISOLADA    | —               | Transversal    | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 16 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
