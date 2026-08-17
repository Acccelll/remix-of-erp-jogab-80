# Onda 2 — Riscos

## Resumo Executivo

3 riscos identificados para esta onda, com probabilidade, impacto e mitigação.

## Objetivo

Antecipar o que pode dar errado e como conter.

## Escopo

Riscos de execução específicos da Onda 2.

## Conteúdo

| Risco                                                   | Probabilidade | Impacto    | Mitigação                                                                   |
| ------------------------------------------------------- | ------------- | ---------- | --------------------------------------------------------------------------- |
| Apertar o RLS derruba tela legítima (QR público, edges) | Alta          | Alto       | Lotes por tabela + E2E por lote + política mínima específica                |
| Reforma de auth bloqueia todos os usuários              | Média         | Muito Alto | Migração de senha faseada; tag imediatamente antes; rollback ensaiado; flag |
| Sessão migrada quebra fluxos de reauth                  | Média         | Alto       | Manter ReauthDialog como rede; testar expiração e refresh                   |

### Riscos herdados do programa

- Executar cirurgia de regressão **Muito Alta** sem caracterização E2E prévia.
- Ampliar escopo sem registro de desvio.
- Separar fusões obrigatórias em trabalhos distintos.

## Conclusão

Esta onda concentra os maiores riscos do programa — execute com rollback ensaiado e feature flags.

## Referências

- [Criticidade](04_Criticidade.md) · [Plano de Regressão](07_Plano_Regressao.md) · [Plano Mestre](../../00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
