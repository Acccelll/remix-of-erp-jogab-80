# Onda 4 — Escopo

## Resumo Executivo

Consistência transversal de interface, formatação e listas. Esta onda contém **16 Achados** e tem esforço relativo **Média**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID           | Título                                                                  | Categoria           |
| ------------ | ----------------------------------------------------------------------- | ------------------- |
| **DS-002**   | Dois sistemas de toast (sonner x84 / use-toast x9)                      | Design System       |
| **DS-006**   | Moeda sem fonte única (BRL inline em 32 páginas; money x currency)      | Design System       |
| **DS-010**   | Paginação inexistente como padrão (primitivo pronto, 2 usos)            | Design System       |
| **PERF-002** | Consultas de lista sem limite e sem projeção (24 select(*), 31 limit)   | Performance         |
| **QC-003**   | Tratamento de erros sem política única (4 destinos; 15 catch vazios)    | Qualidade de Código |
| **UX-001**   | Telas sem porta (Suprimentos estruturante) e configurações fragmentadas | UX                  |
| **BIZ-004**  | Datas sem módulo central (48 arquivos formatam inline)                  | Regras de Negócio   |
| **DS-003**   | window.confirm nativo em 5 telas                                        | Design System       |
| **DS-004**   | Subadoção de QueryState/EmptyState (spinner manual em 31 páginas)       | Design System       |
| **DS-005**   | Mapas status->rótulo/cor duplicados em 15 arquivos                      | Design System       |
| **DS-007**   | KPI/StatCard reimplementado por dashboard                               | Design System       |
| **DS-008**   | Recharts cru em 24 arquivos; ui/chart.tsx com 0 usos                    | Design System       |
| **DS-009**   | 24 de 28 telas com tabela crua fora de ui/data-table                    | Design System       |
| **DS-014**   | Biblioteca sem catálogo/documentação                                    | Design System       |
| **DS-012**   | 8 diálogos de importação repetindo a mesma casca                        | Design System       |
| **DS-015**   | Sem escala de tamanhos de Dialog; sem barra de filtros padrão           | Design System       |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Onda 1 aprovada. (Itens sem dependência podem ser antecipados.)

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 16 Achados, marco **M5**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
