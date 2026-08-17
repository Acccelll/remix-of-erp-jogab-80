# Onda 6 — Riscos

## Resumo Executivo

3 riscos identificados para esta onda, com probabilidade, impacto e mitigação.

## Objetivo

Antecipar o que pode dar errado e como conter.

## Escopo

Riscos de execução específicos da Onda 6.

## Conteúdo

| Risco                                                | Probabilidade | Impacto    | Mitigação                                                                |
| ---------------------------------------------------- | ------------- | ---------- | ------------------------------------------------------------------------ |
| God-context: regressão silenciosa em 86 consumidores | Alta          | Muito Alto | TST-001.b + TST-002 obrigatórios; fatiar por domínio; flags              |
| Quebra de monólito altera comportamento de card/obra | Média         | Alto       | Preservar comportamento por teste; dividir por seção                     |
| Migração do DP perde histórico                       | Baixa         | Muito Alto | Matriz de canonicidade (D-3); migrar entidade a entidade com verificação |

### Riscos herdados do programa

- Executar cirurgia de regressão **Muito Alta** sem caracterização E2E prévia.
- Ampliar escopo sem registro de desvio.
- Separar fusões obrigatórias em trabalhos distintos.

## Conclusão

Esta onda concentra os maiores riscos do programa — execute com rollback ensaiado e feature flags.

## Referências

- [Criticidade](04_Criticidade.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 5](../ONDA_05/README.md) · [Índice de Ondas](../) · [Onda 7 →](../ONDA_07/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
