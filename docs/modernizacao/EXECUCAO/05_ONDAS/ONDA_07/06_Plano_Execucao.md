# Onda 7 — Plano de Execução

## Resumo Executivo

Sequência operacional da onda: o que iniciar em paralelo, o que respeitar em ordem, e como encerrar.

## Objetivo

Dar ao executor a ordem exata de trabalho.

## Escopo

Ordem interna dos 43 Achados, versionamento e encerramento.

## Conteúdo

### Sequência

| Passo | Ação                                                 | Detalhe                                                                                                                                                                                                                                                                                                                  |
| ----- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Iniciar em paralelo os Achados sem dependência       | `PRO-001`, `PRO-003`, `PRO-005`, `PRO-006`, `PRO-009`, `PRO-018`, `PRO-002`, `PRO-015`, `PRO-016`, `PRO-020`, `PRO-022`, `PRO-024`, `PRO-025`, `PRO-029`, `PRO-030`, `UX-003`, `UX-007`, `DB-006`, `EST-003`, `PERF-004`, `PRO-012`, `PRO-017`, `PRO-021`, `PRO-023`, `PRO-026`, `PRO-027`, `UX-008`, `UX-009`, `UX-010` |
| 2     | Executar `PRO-030` antes de `PRO-007`                | dependência interna                                                                                                                                                                                                                                                                                                      |
| 3     | Executar `PRO-009` antes de `PRO-010`                | dependência interna                                                                                                                                                                                                                                                                                                      |
| 4     | Executar `OPS-003` antes de `OPS-004`                | dependência interna                                                                                                                                                                                                                                                                                                      |
| 5     | Executar `PRO-007` antes de `PRO-008`                | dependência interna                                                                                                                                                                                                                                                                                                      |
| 6     | Executar `PRO-030` antes de `PRO-019`                | dependência interna                                                                                                                                                                                                                                                                                                      |
| 7     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md                                                                                                                                                                                                                                                                                                |
| 8     | Aplicar o Checklist de Conclusão e tagear o marco M8 | ver 10_Checklist_Conclusao.md                                                                                                                                                                                                                                                                                            |

### Versionamento desta onda

1. Criar a branch de onda `onda-7`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `PRO-001`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M8`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização livre entre os Achados sem dependência.

- Nenhuma mudança sem ID rastreável.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M8**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
