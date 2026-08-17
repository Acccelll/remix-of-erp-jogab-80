# Onda 2 — Plano de Execução

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
| 1     | Executar `SEC-001` antes de `SEC-002`                | dependência interna           |
| 2     | Executar `SEC-001` antes de `DB-002`                 | dependência interna           |
| 3     | Executar `SEC-001` antes de `SEC-004`                | dependência interna           |
| 4     | Executar `SEC-001` antes de `SEC-005`                | dependência interna           |
| 5     | Executar `SEC-001` antes de `SEC-007`                | dependência interna           |
| 6     | Executar `SEC-005` antes de `SEC-007`                | dependência interna           |
| 7     | Reexecutar o Plano de Regressão da onda              | ver 07_Plano_Regressao.md     |
| 8     | Aplicar o Checklist de Conclusão e tagear o marco M3 | ver 10_Checklist_Conclusao.md |

### Versionamento desta onda

1. Criar a branch de onda `onda-2`.
2. Para cada Achado, criar uma branch com o **ID** (ex.: `SEC-001`).
3. Merge do Achado na branch da onda somente com **CI verde**.
4. Ao concluir todos os Achados e o Checklist, merge na linha principal e **tag `M3`**.
5. Publicar release com os IDs concluídos nas notas.

### Restrições aplicáveis

- Paralelização restrita: respeitar as cirurgias sequenciais.
- ⛔ **Proibido paralelizar** SEC-001, SEC-002 entre si ou com outra frente. SEC-002 executa **por lotes de tabela**, com validação por lote.

- Nenhuma mudança sem ID rastreável.

### Rollback

Tag imediatamente antes de qualquer cirurgia de alto risco. Feature flags são o **primeiro** instrumento de rollback.

## Conclusão

Executada a sequência e aprovado o checklist, a onda encerra com a tag **M3**.

## Referências

- [Dependências](03_Dependencias.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
