# Onda 3 — Riscos

## Resumo Executivo

3 riscos identificados para esta onda, com probabilidade, impacto e mitigação.

## Objetivo

Antecipar o que pode dar errado e como conter.

## Escopo

Riscos de execução específicos da Onda 3.

## Conteúdo

| Risco                                                      | Probabilidade | Impacto | Mitigação                                     |
| ---------------------------------------------------------- | ------------- | ------- | --------------------------------------------- |
| Constraints de fronteira rejeitam dados legados            | Alta          | Médio   | Sanear órfãos antes de aplicar a constraint   |
| Fechar repositories expõe consultas mal formadas           | Média         | Médio   | Testes de integração (TST-002) escritos junto |
| Separar lib pura de impura altera comportamento de cálculo | Baixa         | Alto    | Suíte da lib como rede (421 testes)           |

### Riscos herdados do programa

- Executar cirurgia de regressão **Muito Alta** sem caracterização E2E prévia.
- Ampliar escopo sem registro de desvio.
- Separar fusões obrigatórias em trabalhos distintos.

## Conclusão

Riscos contidos; mitigações são de baixo custo.

## Referências

- [Criticidade](04_Criticidade.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
