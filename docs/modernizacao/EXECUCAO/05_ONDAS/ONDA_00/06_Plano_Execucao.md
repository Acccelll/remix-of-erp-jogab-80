# Onda 0 — Plano de Execução

## Resumo Executivo

Sequência operacional da onda: o que iniciar em paralelo, o que respeitar em ordem, e como encerrar.

## Objetivo

Dar ao executor a ordem exata de trabalho.

## Escopo

Ordem interna dos 8 Achados, versionamento e encerramento.

## Conteúdo

### Sequência

| Passo | Ação                                                 | Detalhe                                                                     |
| ----- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| 1     | Iniciar em paralelo os Achados sem dependência       | `SEC-003`, `EST-002`, `OPS-001`, `OPS-002`, `OPS-006`, `TST-001`, `TST-004` |
| 2     | Executar `EST-002` antes de `UX-004`                 | dependência interna                                                         |
| 3     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md                                                   |
| 4     | Aplicar o Checklist de Conclusão e tagear o marco M1 | ver 10_Checklist_Conclusao.md                                               |

### Versionamento desta onda

1. Criar a branch de onda `onda-0`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `SEC-003`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M1`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização livre entre os Achados sem dependência.

- Nenhuma mudança sem ID rastreável.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M1**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
