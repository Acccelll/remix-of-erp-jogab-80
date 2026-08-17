# Onda 6 — Plano de Execução

## Resumo Executivo

Sequência operacional da onda: o que iniciar em paralelo, o que respeitar em ordem, e como encerrar.

## Objetivo

Dar ao executor a ordem exata de trabalho.

## Escopo

Ordem interna dos 8 Achados, versionamento e encerramento.

## Conteúdo

### Sequência

| Passo | Ação                                                 | Detalhe                       |
| ----- | ---------------------------------------------------- | ----------------------------- |
| 1     | Executar `ARC-002` antes de `ARC-004`                | dependência interna           |
| 2     | Executar `ARC-005` antes de `PERF-001`               | dependência interna           |
| 3     | Executar `ARC-004` antes de `PRO-004`                | dependência interna           |
| 4     | Executar `ARC-005` antes de `PERF-003`               | dependência interna           |
| 5     | Executar `DS-011` antes de `PERF-003`                | dependência interna           |
| 6     | Executar `ARC-005` antes de `DS-011`                 | dependência interna           |
| 7     | Executar `ARC-005` antes de `DS-016`                 | dependência interna           |
| 8     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md     |
| 9     | Aplicar o Checklist de Conclusão e tagear o marco M7 | ver 10_Checklist_Conclusao.md |

### Versionamento desta onda

1. Criar a branch de onda `onda-6`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `ARC-002`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M7`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização restrita: respeitar as cirurgias sequenciais.

- ⛔ **ARC-002 e ARC-004 não se paralelizam** com nada. A fusão `ARC-005 + PERF-001 + DS-011 + DS-016` é **uma única cirurgia**.

- Nenhuma mudança sem ID rastreável.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M7**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
