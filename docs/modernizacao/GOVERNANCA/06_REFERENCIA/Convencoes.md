# Convenções

## Resumo Executivo

Regras de identificação, versionamento e nomenclatura que sustentam a rastreabilidade entre Auditoria e Execução.

## Objetivo

Padronizar como Achados, branches, tags, desvios e artefatos de código são nomeados e referenciados.

## Escopo

IDs, prefixos, branches, commits, tags, releases, registro de desvios, nomes de arquivo e declarações de tipos.

## Conteúdo

### Prefixos de ID (permanentes)

| Prefixo | Domínio                     | Etapa de origem |
| ------- | --------------------------- | --------------- |
| ARC-    | Arquitetura                 | 4               |
| DS-     | Design System / Componentes | 3, 5            |
| UX-     | Experiência do usuário      | 2, 3            |
| PRO-    | Produto / Funcional         | 2               |
| BIZ-    | Regras de negócio           | 6               |
| EST-    | Estado e fluxo de dados     | 7               |
| DB-     | Banco de dados              | 8               |
| QC-     | Qualidade de código         | 9               |
| PERF-   | Performance                 | 10              |
| SEC-    | Segurança                   | 11              |
| TST-    | Testes                      | 12              |
| OPS-    | Operação / Observabilidade  | 13              |

**Regra:** IDs são **permanentes**. Nunca reutilizados, nunca renumerados, nunca removidos do catálogo.

### Cisões

Um Achado cindido recebe sufixo `.a` / `.b` (ex.: `OPS-001.a`). **A cisão não cria um novo ID** e não altera o Achado original.

### Versionamento

- Branch de onda: `onda-N`
- Branch de achado: o próprio ID (`SEC-003`, `ARC-001`)
- Commit / PR: começa pelo ID — `SEC-003: rotaciona segredo e fecha CORS`
- Tag: `M1` … `M8` (um por marco)
- Release: por marco, com a lista de IDs concluídos nas notas

### Registro de desvios

Arquivo versionado com colunas: `ID afetado | Desvio | Motivo | Decisão | Impacto em dependências | Onda`.

### Código — arquivos e tipos (QC-004)

- Arquivos de domínio/utilitários em `src/lib/**`: **kebab-case** (`parser-holerite-xls.ts`, `holerite-repo.ts`).
- Arquivos React de componente/página: **PascalCase** (`EmployeeProfileDialog.tsx`, `PontoAnalise.tsx`).
- Hooks React públicos: prefixo `use` preservado (`useAuthz.ts`, `useOfflineRecord.ts`); quando forem módulos puramente utilitários em `src/lib`, preferir kebab-case.
- Testes espelham o arquivo-alvo e usam sufixo `.test.ts`/`.test.tsx`.
- `index.ts` é permitido apenas como barrel explícito de módulo.
- Novos tipos exportados devem preferir `export type` para shapes, unions, aliases e contratos de dados.
- `export interface` fica reservado para APIs extensíveis por composição/herança, props públicas de componentes quando houver extensão, ou casos em que declaração-merging seja intencional e comentada.

**Aplicação retroativa da Onda 1:** os arquivos camelCase do alvo QC-004 foram consolidados na janela ARC-007 como `alocacao.ts`, `codigos.ts`, `holerite-repo.ts`, `parser-holerite-xls.ts`, `status-especiais.ts` e `tipos.ts`.

## Conclusão

Rastreabilidade nos dois sentidos: do Achado à entrega, e da entrega ao Achado.

## Referências

- [Glossário](Glossario.md) · [Plano Mestre](../../EXECUCAO/00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md) · [Contrato](../../EXECUCAO/00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
