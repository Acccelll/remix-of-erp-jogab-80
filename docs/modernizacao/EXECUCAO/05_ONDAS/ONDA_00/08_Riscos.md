# Onda 0 — Riscos

## Resumo Executivo

3 riscos identificados para esta onda, com probabilidade, impacto e mitigação.

## Objetivo

Antecipar o que pode dar errado e como conter.

## Escopo

Riscos de execução específicos da Onda 0.

## Conteúdo

| Risco                                                | Probabilidade | Impacto | Mitigação                                                              |
| ---------------------------------------------------- | ------------- | ------- | ---------------------------------------------------------------------- |
| CI nasce vermelho por causa da pinagem CDN do `xlsx` | Alta          | Médio   | Corrigir a pinagem antes de OPS-001.a                                  |
| Rotação da senha derruba o backend PHP em produção   | Média         | Alto    | Janela de manutenção; validar nova conexão antes de invalidar a antiga |
| Sentry passa a expor dados sensíveis em eventos      | Baixa         | Médio   | Revisar payloads enviados; sampling já configurado                     |

### Riscos herdados do programa

- Executar cirurgia de regressão **Muito Alta** sem caracterização E2E prévia.
- Ampliar escopo sem registro de desvio.
- Separar fusões obrigatórias em trabalhos distintos.

## Conclusão

Riscos contidos; mitigações são de baixo custo.

## Referências

- [Criticidade](04_Criticidade.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
