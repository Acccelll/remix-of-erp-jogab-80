# Onda 1 — Achados

## Resumo Executivo

Os **12 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 1. Nenhum outro.

## Conteúdo

| ID          | Título                                                                         | Prior. | Compl. | Crit. | Tipo | Estratégia | Dependências    | Módulo      | Origem                                                                           |
| ----------- | ------------------------------------------------------------------------------ | ------ | ------ | ----- | ---- | ---------- | --------------- | ----------- | -------------------------------------------------------------------------------- |
| **ARC-001** | Tipagem Supabase desligada (any) sobre tipos gerados defasados                 | P0     | Média  | C1    | STD  | GLOBAL     | —               | Transversal | [Etapa 1,4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md)   |
| **ARC-009** | Três sistemas de autorização sem fachada única                                 | P1     | Média  | C1    | REF  | SEQUENCIAL | —               | Transversal | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)     |
| **DB-003**  | Histórico de migrations não reconstruível e de baixa legibilidade              | P1     | Média  | C1    | MIG  | ISOLADA    | —               | Plataforma  | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)        |
| **DB-005**  | Entidades espelhadas entre bancos sem canonicidade declarada                   | P1     | Baixa  | C1    | CON  | ISOLADA    | —               | Transversal | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)        |
| **QC-001**  | Compilador TypeScript desativado (strict/strictNullChecks/noImplicitAny false) | P1     | Alta   | C1    | STD  | SEQUENCIAL | ARC-001         | Transversal | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |
| **ARC-006** | Inversões de camada: lib/schemas -> ui; component -> page                      | P2     | Baixa  | C2    | REF  | ISOLADA    | —               | Transversal | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| **ARC-007** | Gavetas: 35 arquivos soltos em lib/ e 35 em components/                        | P2     | Média  | C2    | REF  | LOTE       | —               | Transversal | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)     |
| **QC-002**  | Régua de lint/formatação desligada (no-unused-vars off; sem Prettier)          | P2     | Baixa  | C2    | STD  | LOTE       | QC-001          | Transversal | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |
| **TST-003** | Testes com verificação de tipo desligada (@ts-nocheck em cadeias-criticas)     | P2     | Baixa  | C2    | REF  | ISOLADA    | ARC-001, QC-001 | Transversal | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)           |
| **ARC-011** | 4 páginas órfãs (Index, Ocorrencias, LicoesAprendidas, Riscos)                 | P3     | Baixa  | C3    | REM  | ISOLADA    | —               | Transversal | [Etapa 1,3,4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_01_INVENTARIO_FUNCIONAL.md) |
| **DS-013**  | Peças mortas/presas: ui/form, ui/drawer, ui/chart; EmptyState em obra/         | P3     | Baixa  | C3    | REM  | ISOLADA    | —               | Transversal | [Etapa 5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_05_DESIGN_SYSTEM.md)            |
| **QC-004**  | Convenções de nomes de arquivo e declaração de tipos mistas                    | P3     | Baixa  | C3    | STD  | ISOLADA    | ARC-007         | Transversal | [Etapa 9](../../../GOVERNANCA/01_AUDITORIA/ETAPA_09_QUALIDADE_CODIGO.md)         |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 12 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
