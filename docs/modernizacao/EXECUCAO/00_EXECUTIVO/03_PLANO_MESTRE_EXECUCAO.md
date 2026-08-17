# 03 — Plano Mestre de Execução

## Resumo Executivo

Define **como** a modernização é executada: ordem das ondas, paralelização permitida, versionamento, governança, gate de qualidade e validação. Responde "de que forma", enquanto os dossiês das ondas respondem "o quê".

## Objetivo

Dar ao executor um procedimento operacional único, aplicável a todas as 8 ondas.

## Escopo

Princípio ordenador, ondas, paralelização, versionamento, governança, qualidade, regressão e documentação.

## Índice

1. [Princípio ordenador](#1-princípio-ordenador)
2. [As 8 ondas](#2-as-8-ondas)
3. [Paralelização](#3-paralelização)
4. [Versionamento e rollback](#4-versionamento-e-rollback)
5. [Governança](#5-governança)
6. [Controle de qualidade](#6-controle-de-qualidade)
7. [Documentação](#7-documentação)

## Conteúdo

### 1. Princípio ordenador

> **Conter a exposição → religar as redes de segurança (tipos, CI, testes) → reformar segurança → consolidar dados → padronizar → consolidar regras → refatorar estruturas → completar produto e operação.**

### 2. As 8 ondas

| Onda  | Nome                            | Objetivo                                                                  | Achados | Esforço      | Marco |
| ----- | ------------------------------- | ------------------------------------------------------------------------- | ------- | ------------ | ----- |
| **0** | Contenção                       | Parar a exposição e ligar as luzes antes de tocar arquitetura.            | 8       | Pequena      | M1    |
| **1** | Fundação Técnica                | Religar as redes de segurança do código e documentar a verdade dos dados. | 12      | Grande       | M2    |
| **2** | Reforma de Segurança            | Identidade confiável e dado fechado.                                      | 6       | Muito Grande | M3    |
| **3** | Consolidação de Dados e Camadas | Fronteira íntegra e camada de dados fechada e testada.                    | 8       | Grande       | M4    |
| **4** | Padronização                    | Consistência transversal de interface, formatação e listas.               | 16      | Média        | M5    |
| **5** | Validação e Regras              | Validação única e regras de negócio sem duplicação.                       | 6       | Grande       | M6    |
| **6** | Refatorações Estruturais        | Aposentar o legado, quebrar monólitos e granular render.                  | 8       | Muito Grande | M7    |
| **7** | Produto, UX e Operação Plena    | Fechar valor funcional e maturidade operacional.                          | 43      | Grande       | M8    |
| **8** | Integrações Externas            | Fases 2 de PRO-008/010/015, PRO-017 integral e PRO-026 opcional.          | 5       | A dimensionar | M9   |

### 3. Paralelização

- **Livre** dentro das Ondas 0, 1 (exceto ARC-001/QC-001), 3, 4 e 7.
- **Proibida** entre `SEC-001`, `SEC-002` e `ARC-002`/`ARC-004` — nem entre si, nem com qualquer outra cirurgia.
- `SEC-002` e `ARC-005` admitem paralelismo **interno** (por tabela / por arquivo).

### 4. Versionamento e rollback

| Elemento             | Convenção                                                                         |
| -------------------- | --------------------------------------------------------------------------------- |
| **Branch de onda**   | uma branch de longa duração por onda (`onda-N`)                                   |
| **Branch de achado** | uma branch curta por ID (`ARC-001`, `SEC-003`) — um achado = uma unidade de merge |
| **Checkpoint**       | merge do achado na branch da onda, com CI verde                                   |
| **Tag**              | uma tag por marco (M1..M9), no merge de encerramento da onda                      |
| **Release**          | uma por marco; notas listam os **IDs** concluídos                                 |

**Rollback em três camadas:** (a) **código** — reverter o merge da onda até a tag do marco anterior; (b) **schema** — cada migration da onda declara procedimento de reversão; rollback de código exige rollback coordenado de schema (OPS-006.b); (c) **configuração/flags** — as feature flags existentes desligam comportamento sem reverter código.

> **Use flags como primeiro instrumento de rollback** nas cirurgias das Ondas 2 e 6. Tag imediatamente antes de cada cirurgia de alto risco.

### 5. Governança

- **ID obrigatório** em toda unidade de trabalho. Trabalho sem ID não entra.
- **Registro de desvios** versionado, revisado ao fim de cada onda.
- **Descobertas de execução (D-xx)** não viram Achados por conta própria.
- **Rastreabilidade:** ID no branch → no commit/PR → na nota de release → no checklist de encerramento → no Plano de Validação.
- **Sumário de uma página por onda** (IDs concluídos, desvios, decisões, pendências transferidas).

### 6. Controle de qualidade

CI como gate desde a **Onda 0** (`install + build + test`), completo na **Onda 1** (`+ lint + typecheck`). **Nenhum merge com CI vermelho.** Baseline histórico: **421 testes verdes**; baseline atual da Onda 7: **906 testes unitários verdes**, com E2E bloqueado por `TST-003` até sessão/ambiente válido.

### 7. Documentação

Documentação é **subproduto de cada onda**, não etapa final. Cada onda atualiza incrementalmente as convenções que produziu (regime de RLS, matriz de canonicidade, política de erro). A consolidação em runbooks acontece na Onda 7 (`OPS-007`).

## Conclusão

O plano é deliberadamente conservador nas cirurgias e agressivo nos quick wins. As 23 entregas de baixo risco antecipam valor sem tocar arquitetura; as frentes estruturais só avançam com rede de testes. A Onda 8 existe apenas como **KICKOFF** até M8, aprovação formal da Onda 7 e D-10 ficarem verdes.

## Referências

- [Contrato](04_CONTRATO_EXECUCAO.md) · [Stage Gate](05_STAGE_GATE_GO_NO_GO.md) · [Roadmap](../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md) · [Ondas](../05_ONDAS/)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
