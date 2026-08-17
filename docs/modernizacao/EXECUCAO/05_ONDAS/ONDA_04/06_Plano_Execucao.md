# Onda 4 — Plano de Execução

## Resumo Executivo

Sequência operacional da onda: o que iniciar em paralelo, o que respeitar em ordem, e como encerrar.

## Objetivo

Dar ao executor a ordem exata de trabalho.

## Escopo

Ordem interna dos 16 Achados, versionamento e encerramento.

## Conteúdo

### Sequência

| Passo | Ação                                                 | Detalhe                                                                                             |
| ----- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1     | Iniciar em paralelo os Achados sem dependência       | `DS-002`, `DS-006`, `UX-001`, `BIZ-004`, `DS-003`, `DS-005`, `DS-007`, `DS-014`, `DS-012`, `DS-015` |
| 2     | Executar `DS-010` antes de `PERF-002`                | dependência interna                                                                                 |
| 3     | Executar `DS-002` antes de `QC-003`                  | dependência interna                                                                                 |
| 4     | Executar `DS-002` antes de `DS-004`                  | dependência interna                                                                                 |
| 5     | Executar `DS-007` antes de `DS-008`                  | dependência interna                                                                                 |
| 6     | Executar `DS-004` antes de `DS-009`                  | dependência interna                                                                                 |
| 7     | Executar `DS-010` antes de `DS-009`                  | dependência interna                                                                                 |
| 8     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md                                                                           |
| 9     | Aplicar o Checklist de Conclusão e tagear o marco M5 | ver 10_Checklist_Conclusao.md                                                                       |

### Versionamento desta onda

1. Criar a branch de onda `onda-4`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `DS-002`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M5`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização livre entre os Achados sem dependência.

- A fusão `DS-010 + PERF-002` é **um único pacote** por lista.

- Nenhuma mudança sem ID rastreável.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M5**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
