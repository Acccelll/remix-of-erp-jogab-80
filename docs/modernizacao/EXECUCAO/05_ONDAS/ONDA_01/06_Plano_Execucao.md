# Onda 1 — Plano de Execução

## Resumo Executivo

Sequência operacional da onda: o que iniciar em paralelo, o que respeitar em ordem, e como encerrar.

## Objetivo

Dar ao executor a ordem exata de trabalho.

## Escopo

Ordem interna dos 12 Achados, versionamento e encerramento.

## Conteúdo

### Sequência

| Passo | Ação                                                 | Detalhe                                                                                         |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1     | Iniciar em paralelo os Achados sem dependência       | `ARC-001`, `ARC-009`, `DB-003`, `DB-005`, `ARC-006`, `ARC-007`, `ARC-011`, `DS-013`             |
| 2     | Executar `ARC-001` antes de `QC-001`                 | dependência interna                                                                             |
| 3     | Executar `QC-001` antes de `QC-002`                  | dependência interna — concluído no escopo Onda 1 com `typecheck` estrito para `lib/`/`services` |
| 4     | Executar `ARC-001` antes de `TST-003`                | dependência interna                                                                             |
| 5     | Executar `QC-001` antes de `TST-003`                 | dependência interna                                                                             |
| 6     | Executar `ARC-007` antes de `QC-004`                 | dependência interna                                                                             |
| 7     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md                                                                       |
| 8     | Aplicar o Checklist de Conclusão e tagear o marco M2 | ver 10_Checklist_Conclusao.md                                                                   |

### Versionamento desta onda

1. Criar a branch de onda `onda-1`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `ARC-001`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M2`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização livre entre os Achados sem dependência.

- Nenhuma mudança sem ID rastreável.

### Registro de execução — QC-001

1. Criar gate incremental `tsconfig.qc001.json` para `src/lib/**` e `src/services/**`.
2. Ligar `strict`, `strictNullChecks` e `noImplicitAny` nesse gate, mantendo `tsconfig.app.json` global inalterado até a limpeza das camadas de UI/contexto.
3. Expor `bun run typecheck` no `package.json`.
4. Tratar o strict global como próxima etapa incremental: expandir o `include` do gate para `hooks/`, depois `contexts/`, depois `components/` e `pages/`, removendo escapes `any` registrados por E-01 à medida que as tabelas fantasmas forem resolvidas.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M2**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
