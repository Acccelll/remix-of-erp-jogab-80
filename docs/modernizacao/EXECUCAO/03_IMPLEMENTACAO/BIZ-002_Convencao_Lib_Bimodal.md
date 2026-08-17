# BIZ-002 — Convenção de Camada `src/lib` (pura × I/O × orquestração)

## Objetivo

Distinguir, **sem abrir o arquivo**, se um módulo de `src/lib` é (a) cálculo puro,
(b) executa I/O (banco/rede/storage) ou (c) orquestra composição de (a)+(b).
Fecha o Achado **BIZ-002**.

## Classificação

Todo arquivo `.ts`/`.tsx` sob `src/lib/` (exceto `__tests__/`, `types/`, `constants/`)
DEVE declarar sua natureza no cabeçalho, na primeira linha não vazia:

```ts
/** @module-kind pure */         // domínio puro: sem I/O, sem window, sem tempo global
/** @module-kind io */           // acessa banco/rede/storage; concentra efeito
/** @module-kind orchestration */// compõe puros com io; pode ler config/env
```

Regras de residência:

- **pure**: nenhum `import` de `@/integrations/supabase`, `fetch`, `localStorage`, `window`, `Date.now()` sem injeção.
- **io**: acesso a banco vive em `src/lib/repositories/**`; fora dali só é aceito para wrappers finos de RPC/serviços externos (`recalculo.ts`, `cnpj.ts`), documentados na exceção abaixo.
- **orchestration**: pode importar `pure` e `io`; não deve conter fórmulas de negócio inline.

## Verificação automática

`scripts/verify-lib-purity.sh` falha (exit 1) quando:

1. Arquivo em `src/lib/` (fora das pastas isentas) não declara `@module-kind`.
2. Arquivo marcado `pure` importa `@/integrations/supabase`, `@supabase/*`, `fetch(` ou `localStorage`.
3. Arquivo com `import ... supabase` fora de `src/lib/repositories/` não é `io` ou `orchestration`.

Executado no CI (OPS-001) e antes de fechar cada onda.

## Exceções documentadas

| Arquivo                                | Motivo                                                   |
| -------------------------------------- | -------------------------------------------------------- |
| `src/lib/cards/trello-import.ts`       | Utilitário isolado de importação Trello (ver ARC-003.c.5). Marcado `io`; parse/domínio puro extraído para `src/lib/cards/trello-parse.ts` em BIZ-002.b. |
| `src/lib/cronograma/recalculo.ts`      | Wrapper fino de RPC atômica; marcado `io`.               |
| `src/lib/cnpj.ts`                      | Wrapper de serviço externo (BrasilAPI); marcado `io`.    |
| `src/lib/auth/ensureCloudSession.ts`   | Bootstrap de sessão; marcado `io`.                       |

## Lotes de adoção

- **BIZ-002.a** (este changeset): convenção escrita + script de verificação + marcação `@module-kind` dos 15 arquivos com I/O direto e dos módulos `pmbok/evm.ts`, `cronograma/gantt-edicao.ts`, `resultado/curva-resultado.ts` (âncoras puras).
- **BIZ-002.b**: extrair parse/domínio puro de `cards/trello-import.ts` para `cards/trello-parse.ts` e isolar upload de `bms/boletim.ts` em `bms/boletim-storage.ts`.
- **BIZ-002.c**: mover `financeiro-totvs/{queries,centros,labels}.ts`, `ponto/pontoRepo.ts`, `ponto/pontoQueries.ts`, `notificacoes/index.ts`, `obras/sync.ts`, `faturamento/upsert.ts`, `cronograma/{recalcular-cpm,persistir-calendarios}.ts` para `repositories/` ou marcar como `orchestration` com I/O delegado.
- **BIZ-002.d**: ligar o script no CI e propagar `@module-kind pure` para os módulos restantes de domínio.

## Critérios de aceite (BIZ-002 completo)

- [x] Convenção declarada e escrita (este documento).
- [ ] Os 15 arquivos I/O classificados e residentes conforme a convenção.
- [ ] Verificação automática impedindo acesso a banco fora da camada de dados.
- [ ] Zero `supabase` em módulos marcados `pure`.
