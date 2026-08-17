# Onda 1 — Riscos

## Resumo Executivo

3 riscos identificados para esta onda, com probabilidade, impacto e mitigação.

## Objetivo

Antecipar o que pode dar errado e como conter.

## Escopo

Riscos de execução específicos da Onda 1.

## Conteúdo

| Risco                                                     | Probabilidade | Impacto | Mitigação                                                                   |
| --------------------------------------------------------- | ------------- | ------- | --------------------------------------------------------------------------- |
| Strict global expõe milhares de erros e paralisa a frente | Alta          | Médio   | Executar por ondas: lib → repositories → páginas; testes verdes a cada onda |
| ARC-001 altera contratos e quebra telas silenciosamente   | Média         | Alto    | TST-001.a como rede; o strict revela antes do runtime                       |
| ARC-009 desenhado sem contemplar RLS-alvo                 | Média         | Alto    | Desenhar ARC-009 já com a decisão D-2 registrada                            |

### Riscos herdados do programa

- Executar cirurgia de regressão **Muito Alta** sem caracterização E2E prévia.
- Ampliar escopo sem registro de desvio.
- Separar fusões obrigatórias em trabalhos distintos.

## Conclusão

Riscos contidos; mitigações são de baixo custo.

## Referências

- [Criticidade](04_Criticidade.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 0](../ONDA_00/README.md) · [Índice de Ondas](../) · [Onda 2 →](../ONDA_02/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
