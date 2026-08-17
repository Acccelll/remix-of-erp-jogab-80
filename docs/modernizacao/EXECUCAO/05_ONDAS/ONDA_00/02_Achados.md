# Onda 0 — Achados

## Resumo Executivo

Os **8 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 0. Nenhum outro.

## Conteúdo

| ID            | Título                                                                                                                    | Prior. | Compl. | Crit. | Tipo | Estratégia | Dependências | Módulo         | Origem                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ----- | ---- | ---------- | ------------ | -------------- | --------------------------------------------------------------------------------- |
| **SEC-003**   | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto                                                  | P0     | Baixa  | C0    | STD  | ISOLADA    | —            | Plataforma     | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)                |
| **EST-002**   | Escopo multiempresa não flui para os dados (filtro não filtra)                                                            | P1     | Média  | C1    | REF  | ISOLADA    | —            | Transversal    | [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)        |
| **OPS-001**   | Ausência de CI (gate de qualidade antes do deploy)                                                                        | P1     | Baixa  | C1    | NEW  | ISOLADA    | —            | Plataforma     | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **OPS-002.a** | Sentry instalado e inicializado (NO-OP sem DSN) — parte código de OPS-002 (ver [W-001](../../00_EXECUTIVO/06_WAIVERS.md)) | P1     | Baixa  | C1    | MOD  | ISOLADA    | —            | Plataforma     | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **OPS-006.a** | Scripts de backup/restore MySQL + runbook — parte código/doc de OPS-006 (ver [W-001](../../00_EXECUTIVO/06_WAIVERS.md))   | P1     | Média  | C1    | DOC  | SEQUENCIAL | —            | Plataforma     | [Etapa 13](../../../GOVERNANCA/01_AUDITORIA/ETAPA_13_OBSERVABILIDADE_OPERACAO.md) |
| **TST-001**   | Ausência de testes E2E dos fluxos críticos de negócio                                                                     | P1     | Alta   | C0    | NEW  | SEQUENCIAL | —            | M1, M5, M7, M8 | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)            |
| **UX-004**    | Escopo multiempresa silencioso (sem sinalização por tela)                                                                 | P1     | Média  | C2    | MOD  | SEQUENCIAL | EST-002      | Transversal    | [Etapa 2,3](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md)     |
| **TST-004**   | Ausência de medição de cobertura                                                                                          | P2     | Baixa  | C2    | STD  | ISOLADA    | —            | Transversal    | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)            |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 8 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
