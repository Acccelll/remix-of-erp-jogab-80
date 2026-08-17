# Onda 1 — Escopo

## Resumo Executivo

Religar as redes de segurança do código e documentar a verdade dos dados. Esta onda contém **12 Achados** e tem esforço relativo **Grande**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID          | Título                                                                         | Categoria           |
| ----------- | ------------------------------------------------------------------------------ | ------------------- |
| **ARC-001** | Tipagem Supabase desligada (any) sobre tipos gerados defasados                 | Arquitetura         |
| **ARC-009** | Três sistemas de autorização sem fachada única                                 | Arquitetura         |
| **DB-003**  | Histórico de migrations não reconstruível e de baixa legibilidade              | Banco de Dados      |
| **DB-005**  | Entidades espelhadas entre bancos sem canonicidade declarada                   | Banco de Dados      |
| **QC-001**  | Compilador TypeScript desativado (strict/strictNullChecks/noImplicitAny false) | Qualidade de Código |
| **ARC-006** | Inversões de camada: lib/schemas -> ui; component -> page                      | Arquitetura         |
| **ARC-007** | Gavetas: 35 arquivos soltos em lib/ e 35 em components/                        | Arquitetura         |
| **QC-002**  | Régua de lint/formatação desligada (no-unused-vars off; sem Prettier)          | Qualidade de Código |
| **TST-003** | Testes com verificação de tipo desligada (@ts-nocheck em cadeias-criticas)     | Testes              |
| **ARC-011** | 4 páginas órfãs (Index, Ocorrencias, LicoesAprendidas, Riscos)                 | Arquitetura         |
| **DS-013**  | Peças mortas/presas: ui/form, ui/drawer, ui/chart; EmptyState em obra/         | Design System       |
| **QC-004**  | Convenções de nomes de arquivo e declaração de tipos mistas                    | Qualidade de Código |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Onda 0 aprovada.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 12 Achados, marco **M2**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
