# Onda 5 — Plano de Execução

## Resumo Executivo

Sequência operacional da onda: o que iniciar em paralelo, o que respeitar em ordem, e como encerrar.

## Objetivo

Dar ao executor a ordem exata de trabalho.

## Escopo

Ordem interna dos 6 Achados, versionamento e encerramento.

## Conteúdo

### Sequência

| Passo | Ação                                                 | Detalhe                       |
| ----- | ---------------------------------------------------- | ----------------------------- |
| 1     | Iniciar em paralelo os Achados sem dependência       | `BIZ-001`                     |
| 2     | Executar `BIZ-003` antes de `DS-001`                 | dependência interna           |
| 3     | Executar `PRO-013` antes de `PRO-011`                | dependência interna           |
| 4     | Executar `PRO-013` antes de `PRO-014`                | dependência interna           |
| 5     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md     |
| 6     | Aplicar o Checklist de Conclusão e tagear o marco M6 | ver 10_Checklist_Conclusao.md |

### Versionamento desta onda

1. Criar a branch de onda `onda-5`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `BIZ-001`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M6`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização restrita: respeitar as cirurgias sequenciais.

- A fusão `DS-001 + BIZ-003` é **um único programa** de validação.
- Nenhuma mudança sem ID rastreável.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M6**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
