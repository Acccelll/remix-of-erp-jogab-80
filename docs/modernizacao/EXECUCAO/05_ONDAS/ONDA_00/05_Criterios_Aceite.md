# Onda 0 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 0

- [ ] Segredo do MySQL rotacionado (assumido comprometido) e fora do código
- [ ] `.env` no `.gitignore`
- [ ] CORS sem fallback `*` quando há credenciais
- [ ] `xlsx` instalável a partir do registro padrão (pré-condição do CI)
- [ ] CI (install+build+test) bloqueando commit vermelho
- [ ] Sentry capturando um erro de teste com release e ambiente
- [ ] Backup do MySQL **restaurado com sucesso ao menos uma vez**
- [ ] Cobertura medida com baseline registrado
- [ ] E2E de caracterização (TST-001.a) verde no estado atual
- [ ] Seleção de empresa altera comprovadamente os dados exibidos

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md), [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md), [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md), [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md), [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)).
- [ ] **CI verde** (install + build + test).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [ ] Documentação incremental atualizada.

### Achados e suas fichas

| ID        | Título                                                                   | Ficha completa em                                                                 |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `SEC-003` | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)                |
| `EST-002` | Escopo multiempresa não flui para os dados (filtro não filtra)           | [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)        |
| `OPS-001` | Ausência de CI (gate de qualidade antes do deploy)                       | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `OPS-002` | Error tracking desligado na prática (Sentry não instalado)               | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `OPS-006` | Backup do host MySQL e rollback de schema não evidenciados               | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| `TST-001` | Ausência de testes E2E dos fluxos críticos de negócio                    | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)            |
| `UX-004`  | Escopo multiempresa silencioso (sem sinalização por tela)                | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| `TST-004` | Ausência de medição de cobertura                                         | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)            |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
