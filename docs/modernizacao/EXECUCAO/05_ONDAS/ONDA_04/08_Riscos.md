# Onda 4 — Riscos

## Resumo Executivo

3 riscos identificados para esta onda, com probabilidade, impacto e mitigação.

## Objetivo

Antecipar o que pode dar errado e como conter.

## Escopo

Riscos de execução específicos da Onda 4.

## Conteúdo

| Risco                                                       | Probabilidade | Impacto | Mitigação                                                   |
| ----------------------------------------------------------- | ------------- | ------- | ----------------------------------------------------------- |
| Agregados quebram ao paginar (totais calculados no cliente) | Média         | Médio   | Mover agregados ao servidor e conferir contra o array atual |
| Varredura de toast/estados introduz regressão visual        | Baixa         | Baixo   | Revisão por amostragem; suíte de componentes                |
| Unificar tabela altera ordenação/filtros existentes         | Média         | Médio   | Migrar lista a lista com paridade verificada                |

### Riscos herdados do programa

- Executar cirurgia de regressão **Muito Alta** sem caracterização E2E prévia.
- Ampliar escopo sem registro de desvio.
- Separar fusões obrigatórias em trabalhos distintos.

## Conclusão

Riscos contidos; mitigações são de baixo custo.

## Referências

- [Criticidade](04_Criticidade.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
