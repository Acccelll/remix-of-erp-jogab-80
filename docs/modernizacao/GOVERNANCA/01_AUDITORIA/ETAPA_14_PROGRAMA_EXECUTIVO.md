# ETAPA 14 — Consolidação Estratégica, Priorização Executiva e Programa de Implementação — Planifik

**Papel:** Chief Software Architect / Technical Program Manager / Auditor Líder
**Natureza:** documento de consolidação. **Nenhuma nova auditoria, nenhum novo achado, nenhum diagnóstico alterado.** Unifica os **107 achados** das Etapas 1–13 num Programa Executivo de Evolução que o Lovable executa sem reinterpretar a auditoria.
**Status:** encerra a fase de Auditoria e Planejamento. Tudo a seguir pertence à fase de Execução.

---

## ETAPA A — Revisão Final do Catálogo Mestre

Releitura completa dos 107 achados. Resultado da verificação de duplicações, conflitos, prioridades incompatíveis e dependências incorretas:

**Consolidações confirmadas (já feitas nas etapas, reafirmadas aqui):** DB-002 ≡ núcleo de SEC-002 (RLS permissivo) — tratados como **um único trabalho sob SEC-002**, DB-002 permanece no catálogo como origem/evidência de dados com ponteiro para SEC-002; QC-003 (política de erro) e OPS-002 (Sentry) e EST-001 (rollback) formam a **tríade de tratamento de erro** — distintos mas co-executáveis; BIZ-003 e DS-001 são o **mesmo programa de validação** visto do domínio e da UI.

**Ajustes de dependência aplicados nesta consolidação (rastreados):**

- **SEC-002 depende de SEC-001** (RLS por papel exige identidade confiável) — reafirmado.
- **TST-001 (E2E) reposicionado como pré-condição de caracterização** das cirurgias P0/P1, não como item tardio.
- **OPS-001/002/006 elevados ao bloco de contenção inicial** (baratos, protegem todas as cirurgias).

**Itens obsoletos/redundantes:** nenhum a remover — os 107 são distintos. Quatro páginas órfãs (ARC-011) e peças mortas (DS-013) são alvos de remoção, não achados redundantes.

**Conflito de prioridade resolvido:** havia tensão entre "ARC-001 primeiro" (posição técnica das Etapas 4–9) e "segurança primeiro" (Etapa 11). **Resolução oficial:** o bloco de **contenção de segurança** (SEC-003 + início de SEC-001) precede ARC-001 por gravidade de exposição, mas ARC-001 continua sendo o **pré-requisito técnico** de todas as cirurgias — os dois coexistem na Onda 0/1 sem conflito (§J).

Rastreabilidade preservada: todo ID mantém prefixo, número e etapa de origem originais. **Nenhum ID reutilizado ou renumerado em nenhum momento das 14 etapas.**

---

## ETAPA B — Normalização Final (estado dos campos obrigatórios)

Os 107 achados foram emitidos sob metodologia evolutiva: os campos estendidos (Tipo, Estratégia, Valor, Criticidade C0–C3, Métrica de Sucesso) tornaram-se obrigatórios a partir das Etapas 8/11/12. Para normalização retroativa **sem reabrir diagnóstico**, aplica-se a **regra de herança de campo** abaixo aos achados anteriores (PRO, DS, UX, ARC, BIZ, EST, e parte de DB/QC) que não os traziam explicitamente:

| Campo faltante em achados antigos  | Regra de preenchimento retroativo                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tipo de Implementação**          | derivado da natureza já descrita: PRO→majoritariamente NEW; DS→STD/REF; ARC→REF; UX→MOD/NEW; BIZ→REF/STD; EST→REF                                                   |
| **Estratégia de Execução**         | derivada da complexidade/dependências já documentadas (ISOLADA para P2/P3 sem deps; SEQUENCIAL para cirurgias; LOTE para varreduras; MIGRAÇÃO para SEC-002/PRO-004) |
| **Valor Esperado**                 | derivado da categoria: PRO→UX/CONS; DS→CONS/QUAL; ARC→MAN/SCAL; UX→UX; BIZ→MAN/CONS; EST→CONS/MAN; SEC→SEC; PERF→PERF; TST→TEST; OPS→OBS; DB→MAN/SCAL               |
| **Criticidade de Negócio (C0–C3)** | mapeada da Prioridade+Impacto já atribuídos: P0→C0/C1; P1 Impacto Crítico→C1; P1→C1/C2; P2→C2; P3→C3                                                                |
| **Métrica de Sucesso**             | os **Critérios de Aceite** já presentes em cada ficha servem como métrica verificável — nenhum achado ficou sem critério objetivo                                   |

Com esta regra, **todos os 107 achados possuem os 18 campos** — os já emitidos explicitamente e os herdados por derivação rastreável. Nenhuma ficha fica incompleta; nenhum diagnóstico é alterado.

---

## ETAPA C — Matriz Global de Dependências

**Cadeias obrigatórias (o que precede o quê):**

```
CONTENÇÃO (sem dependências — começam já):
  SEC-003 (segredos+CORS) · OPS-001 (CI) · OPS-002 (Sentry) · OPS-006 (backup host) · TST-004 (cobertura)

RAIZ TÉCNICA:
  ARC-001 (tipos Supabase) ──┬─► ARC-003 (repositories) ─► ARC-005 (monólitos) ─► DS-011, DS-016, PERF-001
                             ├─► QC-001 (strict) ─► QC-002 (lint), TST-003 (contratos tipados)
                             ├─► BIZ-002 (lib pura×impura)
                             ├─► DS-001+BIZ-003 (validação)
                             ├─► UX-002 (busca de dados)
                             └─► PRO-013 (conciliação) ─► PRO-011, PRO-014

RAIZ DE SEGURANÇA:
  SEC-001 (auth) ──► SEC-002 (RLS, ⊇ DB-002) · SEC-004 (sessão) · SEC-005 (rate limit) · SEC-007 (trilha)
       └─ converge com ► ARC-002 (god-context) ─► ARC-004 (estado único) ─► PRO-004 (DP), EST-001 encerrado

RAIZ DE DADOS:
  DB-005 (canonicidade) + DB-003 (baseline) ──► DB-001 (fronteira FK) ; guiam PRO-004
  DB-004 (controle migrations) ──► OPS-006 (rollback coordenado)

ESTADO CRÍTICO (independente, urgente):
  EST-002 (filtro multiempresa não flui) ──► UX-004 (sinalização de escopo)

FORMATAÇÃO TRANSVERSAL (sem deps):
  DS-002 (toast) ─► DS-004 (estados) ─► DS-009 (tabelas) ; DS-005 (status) ; DS-006 (moeda) ; BIZ-004 (datas)
  DS-010 (paginação) + PERF-002 (consultas) = pacote único

OBSERVABILIDADE (após contenção):
  OPS-002 ─► OPS-003 (logs) ─► OPS-004 (monitor) ; OPS-005 (ambientes) com SEC-003 ; OPS-007 (runbooks) por último

TESTES (rede das cirurgias):
  TST-001 (E2E) caracteriza antes de SEC-001/ARC-002/ARC-005 ; TST-002 (integração dados) com ARC-003
```

**Classificação das dependências por natureza:**

- **Dependem de migração:** SEC-002, PRO-004, DB-001, DB-003.
- **Dependem de arquitetura:** ARC-005/DS-011/DS-016/PERF-001 (de ARC-003); ARC-004 (de ARC-002); PRO-004 (de ARC-002/004).
- **Dependem de UX:** UX-004 (de EST-002).
- **Dependem de componentes:** PERF-003 (de ARC-005/DS-011).
- **Dependem de banco:** PRO-011/PRO-013/PRO-014; SEC-002.
- **Dependem de tipos:** QC-001, BIZ-003, TST-003, UX-002 (todos de ARC-001).

**Paralelizáveis desde já (sem dependência entre si):** todo o bloco de contenção + toda a formatação transversal + EST-002 + DS-005/006 + BIZ-004 + PRO-001/009/018/019/029 + ARC-006/007/011 + DB-005/003.

---

## ETAPA D — Eliminação de Conflitos

| Conflito potencial                                                   | Análise                                            | Resolução                                                                                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARC-002 (desmontar god-context) × EST-001 (rollback no legado)       | ambos tocam `contexts/app`                         | EST-001 é medida **interina**; encerra-se por absorção quando ARC-002/004 concluem — executar EST-001 primeiro (proteção imediata), ARC-002 depois |
| SEC-002 (apertar RLS) × telas que hoje dependem de `USING(true)`     | apertar pode derrubar telas legítimas (QR público) | executar **em lotes por tabela** com E2E (TST-001) validando cada lote; QR/edges recebem política mínima específica                                |
| ARC-005 (quebrar monólitos) × PERF-001 (dividir chunks) × DS-011/016 | mesmos arquivos (CardGenericoDialog, obra)         | **executar como cirurgia única** — quebrar o monólito já divide o chunk e cria as costuras de memo/apresentação                                    |
| DS-010 (paginação UI) × PERF-002 (consulta com limite)               | mesma tela, camadas diferentes                     | **pacote único** por lista                                                                                                                         |
| DS-001 (form UI) × BIZ-003 (validação domínio)                       | mesma interação                                    | **programa único de validação**, padrão antes da adoção                                                                                            |
| QC-001 (strict global) × testes com `@ts-nocheck` (TST-003)          | strict expõe erros nos testes                      | ARC-001→QC-001→TST-003 nesta ordem evita ruído                                                                                                     |
| PRO-004 (DP fonte única) × migração PHP→Supabase                     | depende de ARC-004 pronto e DB-005 (canonicidade)  | sequenciar após a raiz de estado e a matriz de canonicidade                                                                                        |

Nenhum conflito irreconciliável. Todos resolvidos por **ordenação** ou **fusão em cirurgia única**.

---

## ETAPA E — Agrupamento por Domínio

| Domínio                       | Achados                                                       | Total   |
| ----------------------------- | ------------------------------------------------------------- | ------- |
| **Segurança**                 | SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006, SEC-007 | 7       |
| **Arquitetura**               | ARC-001..011                                                  | 11      |
| **Estado/Dados-fluxo**        | EST-001, EST-002, EST-003                                     | 3       |
| **Banco/Dados**               | DB-001..006                                                   | 6       |
| **Regras de Negócio**         | BIZ-001, BIZ-002, BIZ-003, BIZ-004                            | 4       |
| **Design System/Componentes** | DS-001..016                                                   | 16      |
| **UX/Navegação**              | UX-001..010                                                   | 10      |
| **Produto/Funcional**         | PRO-001..031                                                  | 31      |
| **Qualidade de Código**       | QC-001..004                                                   | 4       |
| **Performance**               | PERF-001..004                                                 | 4       |
| **Testes**                    | TST-001..004                                                  | 4       |
| **Operação/Observabilidade**  | OPS-001..007                                                  | 7       |
| **Total**                     |                                                               | **107** |

---

## ETAPA F — Agrupamento por Tipo de Implementação

| Natureza                        | Achados representativos                                                                                         | Peso                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Refatorações (REF)**          | ARC-002/003/004/005/006, BIZ-001/002, DS-009, PERF-001/003, SEC-001/004, QC-001, EST-001, TST-003               | alto esforço             |
| **Padronizações (STD)**         | DS-002/005/006/010/014/015, QC-001/002/003/004, DB-002/006, PERF-002, SEC-002/003/006, OPS-003/005, BIZ-003/004 | médio, muitos quick wins |
| **Consolidações (CON)**         | DB-001/005, SEC-002                                                                                             | documental+técnico       |
| **Migrações (MIG/MIGRAÇÃO)**    | SEC-002, PRO-004, DB-001/003, ARC-004                                                                           | planejadas               |
| **Novas Funcionalidades (NEW)** | maioria dos PRO (001..031), SEC-005/007, TST-001/002, OPS-001/004/006, UX-002                                   | valor de produto         |
| **Remoções (REM)**              | ARC-011 (órfãs), DS-013 (peças mortas), parte de SEC-003                                                        | limpeza                  |
| **Documentação (DOC)**          | DB-003/004/005, OPS-005/007, DS-014                                                                             | sustentação              |
| **Modernização**                | DS-001/007/008/011/012/016, UX-*                                                                                | evolução de UX/DS        |

---

## ETAPA G — Quick Wins (baixo risco · baixa complexidade · alto benefício · poucas dependências)

| ID          | Quick win                                      | Por que agora                        | Dep.                 |
| ----------- | ---------------------------------------------- | ------------------------------------ | -------------------- |
| **SEC-003** | Segredos fora do repo + rotação + CORS estrito | contém exposição crítica em horas    | —                    |
| **OPS-001** | CI (lint+test+typecheck+build gate)            | protege TODAS as cirurgias seguintes | QC-001/002 (parcial) |
| **OPS-002** | Ligar Sentry                                   | erros passam a ser vistos            | —                    |
| **OPS-006** | Backup verificado do host                      | evita perda de dados-mestre          | —                    |
| **TST-004** | Medir cobertura                                | instrumenta a evolução               | —                    |
| **EST-002** | Fazer o filtro de empresa filtrar              | corrige decisão sobre dado errado    | —                    |
| **DS-002**  | Toast único                                    | remove divergência visível           | —                    |
| **DS-003**  | Eliminar `window.confirm`                      | consistência                         | —                    |
| **DS-005**  | Mapa central de status                         | 15 arquivos → 1                      | —                    |
| **DS-006**  | Moeda única                                    | dado financeiro consistente          | —                    |
| **BIZ-004** | Módulo de datas                                | 48 pontos → 1                        | —                    |
| **PRO-001** | Motivo de perda no CRM                         | inteligência comercial               | —                    |
| **PRO-009** | Cotação vencedora → OC                         | fecha elo de compras                 | —                    |
| **PRO-018** | Importador BMS canônico                        | plano já existe                      | —                    |
| **PRO-019** | Alerta de renovação de contrato                | baixo custo                          | —                    |
| **ARC-011** | Remover páginas órfãs                          | limpeza segura                       | —                    |
| **ARC-006** | Corrigir 2 inversões de camada                 | precedente sanado                    | —                    |

**17 quick wins** — nenhum depende de cirurgia; juntos elevam segurança, operação, consistência e valor de produto antes de qualquer refatoração estrutural.

---

## ETAPA H — Grandes Refatorações (estruturais, exigem planejamento)

| ID(s)                               | Refatoração                                                                 | Escala     | Pré-condição indispensável                            |
| ----------------------------------- | --------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| **SEC-001 + SEC-002**               | Reforma de autenticação + regime único de RLS                               | Muito Alta | contenção (SEC-003) + E2E de caracterização (TST-001) |
| **ARC-002 + ARC-004**               | Desmonte do god-context + paradigma único de estado                         | Muito Alta | ARC-001 + TST-001/002                                 |
| **ARC-005 + PERF-001 + DS-011/016** | Quebra dos 10 monólitos = divisão de chunks + peças apresentacionais/kanban | Alta       | ARC-001 + ARC-003                                     |
| **DS-001 + BIZ-003**                | Arquitetura de validação (UI + domínio)                                     | Alta       | ARC-001                                               |
| **PRO-004**                         | Fim da dualidade DP (fonte única)                                           | Alta       | ARC-004 + DB-005                                      |
| **SEC-002 (lotes)**                 | Fechamento do RLS por tabela                                                | Alta       | SEC-001                                               |
| **PRO-011 + PRO-013 + PRO-014**     | Conciliação financeira + three-way match + DRE                              | Alta       | ARC-001                                               |

Sete frentes estruturais. Todas dependem da **raiz** (ARC-001 e/ou SEC-001) e da **rede de testes** (TST-001/002) — daí a ordem do roadmap.

---

## ETAPA I — Matriz de Execução (visão consolidada)

Legenda esforço: ● baixo · ●● médio · ●●● alto · ●●●● muito alto.

| ID                                           | Área        | Objetivo             | Tipo    | Estratégia   | Compl.      | Crit. | Prior. | Depend.          | Esforço | Valor     | Paralelo? |
| -------------------------------------------- | ----------- | -------------------- | ------- | ------------ | ----------- | ----- | ------ | ---------------- | ------- | --------- | --------- |
| SEC-003                                      | Segurança   | Segredos+CORS        | STD/REM | ISOLADA      | Baixa       | C0    | P0     | —                | ●       | SEC       | Sim       |
| SEC-001                                      | Segurança   | Auth criptográfica   | REF/MOD | SEQUENCIAL   | Alta        | C0    | P0     | conv. ARC-004    | ●●●●    | SEC       | Não       |
| SEC-002                                      | Segurança   | RLS único (⊇DB-002)  | STD/CON | MIGRAÇÃO     | Alta        | C0    | P0     | SEC-001, ARC-009 | ●●●●    | SEC       | Parcial   |
| OPS-001                                      | Operação    | CI gate              | NEW     | ISOLADA      | Baixa       | C1    | P1     | QC-001/002       | ●       | OBS       | Sim       |
| OPS-002                                      | Operação    | Sentry on            | MOD     | ISOLADA      | Baixa       | C1    | P1     | —                | ●       | OBS       | Sim       |
| OPS-006                                      | Operação    | Backup host+rollback | DOC/NEW | SEQUENCIAL   | Média       | C1    | P1     | DB-003/004       | ●●      | OBS/SEC   | Sim       |
| ARC-001                                      | Arquitetura | Tipos Supabase       | STD     | GLOBAL       | Média       | C1    | P0     | —                | ●●●     | MAN       | Não       |
| QC-001                                       | Qualidade   | Strict por ondas     | STD     | SEQUENCIAL   | Alta        | C1    | P1     | ARC-001          | ●●●     | QUAL      | Parcial   |
| EST-002                                      | Estado      | Filtro empresa real  | REF     | ISOLADA      | Média       | C1    | P1     | —                | ●●      | CONS      | Sim       |
| UX-004                                       | UX          | Sinalização escopo   | MOD     | SEQUENCIAL   | Média       | C2    | P1     | EST-002          | ●●      | UX        | Sim       |
| ARC-003                                      | Arquitetura | Repositories 100%    | REF     | LOTE         | Média       | C1    | P1     | ARC-001          | ●●●     | MAN       | Sim       |
| BIZ-002                                      | Regras      | Lib pura×impura      | REF     | LOTE         | Média       | C1    | P1     | ARC-001/003      | ●●●     | MAN       | Sim       |
| DS-001+BIZ-003                               | DS/Regras   | Validação            | STD     | GLOBAL       | Alta        | C1    | P1     | ARC-001          | ●●●     | CONS      | Parcial   |
| ARC-005+PERF-001                             | Arq/Perf    | Monólitos+chunks     | REF     | SEQUENCIAL   | Alta        | C1    | P1     | ARC-001/003      | ●●●●    | PERF/MAN  | Parcial   |
| ARC-002+ARC-004                              | Arquitetura | God-context+estado   | REF     | MIGRAÇÃO     | M.Alta      | C1    | P1     | ARC-001, TST     | ●●●●    | MAN/SCAL  | Não       |
| PRO-004                                      | Produto     | DP fonte única       | MIG     | MIGRAÇÃO     | Alta        | C1    | P1     | ARC-004, DB-005  | ●●●     | CONS      | Não       |
| DS-010+PERF-002                              | DS/Perf     | Paginação+consulta   | STD     | LOTE         | Média       | C2    | P1     | ARC-003          | ●●      | PERF/SCAL | Sim       |
| DB-005                                       | Banco       | Canonicidade         | CON/DOC | ISOLADA      | Baixa       | C1    | P1     | —                | ●       | MAN       | Sim       |
| DB-003                                       | Banco       | Baseline schema      | MIG/DOC | ISOLADA      | Média       | C1    | P1     | —                | ●●      | MAN       | Sim       |
| DB-001                                       | Banco       | Fronteira FK         | MOD/CON | SEQUENCIAL   | Média       | C1    | P1     | DB-005           | ●●      | MAN       | Sim       |
| TST-001                                      | Testes      | E2E jornadas         | NEW     | SEQUENCIAL   | Alta        | C0    | P1     | SEC-001/EST-002  | ●●●     | TEST      | Parcial   |
| TST-002                                      | Testes      | Integração dados     | NEW     | LOTE         | Alta        | C1    | P1     | ARC-003          | ●●●     | TEST      | Sim       |
| BIZ-001                                      | Regras      | EVM fonte única      | REF     | ISOLADA      | Média       | C2    | P1     | —                | ●●      | CONS      | Sim       |
| _(quick wins DS/PRO/UX/QC/OPS/DB restantes)_ | vários      | §G + P2/P3           | vários  | ISOLADA/LOTE | Baixa-Média | C2-C3 | P1-P3  | ver §C           | ●/●●    | vários    | Sim       |

_(Os 107 achados completos mantêm suas fichas nas etapas de origem; esta matriz consolida os de maior peso e as cabeças de cada cadeia — a rastreabilidade por ID é total.)_

---

## ETAPA J — Roadmap Executivo (ondas)

### Onda 0 — Contenção (dias)

**Objetivo:** parar a exposição e ligar as luzes antes de tocar arquitetura.
**Escopo:** SEC-003 (rotacionar senha, `.env` ignorado, CORS estrito) · OPS-001 (CI) · OPS-002 (Sentry) · OPS-006 (backup host) · TST-004 (cobertura) · EST-002 (filtro empresa) + UX-004.
**Dependências:** nenhuma. **Riscos:** mínimos (aditivos/config). **Conclusão:** segredo rotacionado; CI verde bloqueando commit ruim; erros capturados; backup testado; empresa filtra de fato.

### Onda 1 — Fundação Técnica (raiz)

**Objetivo:** religar as redes de segurança do código.
**Escopo:** ARC-001 (tipos) → QC-001 onda 1 (strict lib/repos) + QC-002 (lint) · DB-005 (canonicidade) · DB-003 (baseline) · ARC-006/007/011 (higiene) · TST-003.
**Dependências:** Onda 0. **Riscos:** strict expõe erros latentes (mitigar por ondas + testes). **Conclusão:** compilador protege a metade nova; schema reconstruível; mapa de canonicidade publicado.

### Onda 2 — Reforma de Segurança

**Objetivo:** identidade confiável e dado fechado.
**Escopo:** SEC-001 (auth) + SEC-005 (rate limit) → SEC-002 em lotes (RLS, absorve DB-002) → SEC-004 (sessão) → SEC-007 (trilha). **Rede:** TST-001 caracteriza login e fluxos antes.
**Dependências:** Onda 0/1. **Riscos:** apertar RLS derruba tela legítima (mitigar por lote+E2E). **Conclusão:** token forjado rejeitado; leitura anônima vazia; QR/edges vivos; trilha de segurança ativa.

### Onda 3 — Consolidação de Dados e Camadas

**Objetivo:** fronteira íntegra e camada de dados fechada.
**Escopo:** ARC-003 (repositories 100%) + BIZ-002 (lib pura×impura) + TST-002 (integração) · DB-001 (fronteira FK) · DB-004 (controle migrations).
**Dependências:** Onda 1. **Riscos:** constraints rejeitam lixo (desejável; sanear antes). **Conclusão:** zero `from()` fora de repo; órfãos zerados; dados testados.

### Onda 4 — Padronização (Design System + Formatação)

**Objetivo:** consistência transversal.
**Escopo:** DS-002/003/004/005/006 · BIZ-004 · DS-007/008 (dashboards) · DS-010+PERF-002 (paginação+consulta) · DS-009 (tabelas) · DS-014/015 · DS-012.
**Dependências:** DS-004 após DS-002; DS-009 após DS-004/010. **Riscos:** baixos. **Conclusão:** um toast, uma moeda, uma data, um status, listas paginadas.

### Onda 5 — Programa de Validação e Regras

**Objetivo:** validação única e regras sem duplicação.
**Escopo:** DS-001+BIZ-003 (validação) · BIZ-001 (EVM único) · PRO-013→PRO-011→PRO-014 (conciliação/three-way/DRE).
**Dependências:** ARC-001. **Riscos:** médios (fluxo financeiro). **Conclusão:** entrada validada igual em tela e importação; um número de curva; recebimento vira título; conciliação fecha.

### Onda 6 — Grandes Refatorações Estruturais

**Objetivo:** aposentar o legado e granular render.
**Escopo:** ARC-005+PERF-001+DS-011+DS-016 (monólitos/chunks/kanban) → ARC-002+ARC-004 (god-context/estado, encerra EST-001) → PRO-004 (DP fonte única) · PERF-003 (render).
**Dependências:** Ondas 1–3 + TST-001/002. **Riscos:** os mais altos do programa (mitigar com E2E como gate). **Conclusão:** nenhum monólito; um paradigma de estado; DP com dono único; chunks sob orçamento.

### Onda 7 — Produto, UX e Operação Plena

**Objetivo:** fechar valor funcional e maturidade operacional.
**Escopo:** PRO restantes (RDO documental, workflow NC, fornecedor, capacidade MO, preventiva…) · UX restantes (busca de dados, rótulos, ajuda, favoritos) · OPS-003/004/005 (logs/monitor/ambientes) · OPS-007 (runbooks) · SEC-006, DS-013, EST-003, QC-004, DB-006, PERF-004.
**Dependências:** ondas anteriores conforme ficha. **Riscos:** baixos-médios. **Conclusão:** produto "fala para fora"; operação documentada e observável.

---

## ETAPA K — Marcos (Milestones)

| #   | Marco                                                              | Alcançado ao concluir |
| --- | ------------------------------------------------------------------ | --------------------- |
| M1  | **Exposição contida**                                              | Onda 0                |
| M2  | **Fundação técnica consolidada** (compilador+schema reconstruível) | Onda 1                |
| M3  | **Segurança consolidada** (auth confiável + RLS fechado)           | Onda 2                |
| M4  | **Dados e camadas consolidados** (fronteira íntegra, repos 100%)   | Onda 3                |
| M5  | **Design System consolidado** (padrões únicos, listas escaláveis)  | Onda 4                |
| M6  | **Regras e fluxo financeiro consolidados**                         | Onda 5                |
| M7  | **Arquitetura consolidada** (legado aposentado, estado único)      | Onda 6                |
| M8  | **Produto e operação prontos para produção/comercialização**       | Onda 7                |

---

## ETAPA L — Matriz de Risco

| Implementação             | Probabilidade | Impacto                     | Mitigação                                                            |
| ------------------------- | ------------- | --------------------------- | -------------------------------------------------------------------- |
| SEC-002 (apertar RLS)     | Alta          | Alto (derruba tela)         | lotes por tabela + E2E por lote; QR/edges com política específica    |
| SEC-001 (auth)            | Média         | Muito Alto (login de todos) | caracterização E2E antes; migração de senha faseada; rollback pronto |
| ARC-002/004 (god-context) | Alta          | Alto (86 consumidores)      | ARC-001+strict antes; TST-001/002 como rede; fatiar por domínio      |
| ARC-005 (monólitos)       | Média         | Alto (features quentes)     | preservar comportamento por testes; dividir por seção                |
| QC-001 (strict)           | Alta          | Médio (onda de erros)       | por ondas (lib→repos→páginas); testes verdes por onda                |
| PRO-004 (DP dual)         | Média         | Alto (dados de folha)       | DB-005 primeiro; migrar entidade a entidade                          |
| DB-001 (FK fronteira)     | Média         | Médio (rejeita lixo)        | sanear órfãos antes de constraint                                    |
| DS-010+PERF-002 (listas)  | Baixa         | Médio (totais)              | agregados no servidor validados vs array                             |
| Onda 0 (contenção)        | Baixa         | Baixo                       | aditivo/config                                                       |

---

## ETAPA M — Matriz de Benefícios

| Área          | Benefício Esperado                                    | Valor Técnico | Valor para o Produto                          |
| ------------- | ----------------------------------------------------- | ------------- | --------------------------------------------- |
| Segurança     | Exposição eliminada; auth confiável; dado fechado     | Alto          | **Crítico** (viabiliza venda enterprise/LGPD) |
| Arquitetura   | Legado aposentado; um paradigma; tipos ligados        | Alto          | Médio (velocidade futura)                     |
| Dados         | Fronteira íntegra; schema reconstruível; canonicidade | Alto          | Médio                                         |
| Design System | Consistência; listas escaláveis; validação única      | Médio         | Alto (UX profissional)                        |
| Performance   | Chunks sob orçamento; consultas limitadas             | Médio         | Alto (uso diário, campo)                      |
| Regras        | EVM único; conciliação; three-way                     | Médio         | **Alto** (confiança no número)                |
| Produto       | RDO documental, NC ativa, fornecedor, capacidade      | Baixo-Médio   | **Crítico** (fecha lacunas de mercado)        |
| Testes        | E2E das jornadas; integração de dados                 | Alto          | Médio (confiança de release)                  |
| Operação      | CI, Sentry, backup, runbooks                          | Alto          | Alto (sustentação por anos)                   |

---

## ETAPA N — Matriz de Regressão (consolidada)

| Fluxo                             | Módulo         | Prioridade | Tipo de Teste           | Criticidade | Regressão esperada |
| --------------------------------- | -------------- | ---------- | ----------------------- | ----------- | ------------------ |
| Login → qualquer módulo           | Auth/todos     | P0         | E2E + unit auth         | C0          | **Muito Alta**     |
| Leitura por papel (RLS)           | Todos Supabase | P0         | E2E acesso + integração | C0          | **Muito Alta**     |
| Mobilização de equipe/frota       | M1             | P1         | E2E + integração        | C1          | Alta               |
| Requisição→cotação→OC→recebimento | M7             | P1         | E2E                     | C1          | Alta               |
| Medição→faturamento→recebimento   | M3/M8          | P1         | E2E + unit EVM          | C1          | Alta               |
| Importação TOTVS→conciliação      | M8             | P1         | integração              | C1          | Alta               |
| Captura de inspeção offline→sync  | M5/M6          | P1         | E2E offline             | C1          | Média              |
| Domínios PHP migrados (DP)        | M9             | P1         | integração              | C1          | **Muito Alta**     |
| Curva/EVM (fonte única)           | M3             | P2         | unit                    | C2          | Média              |
| Listas paginadas (totais)         | M8/M3/M2       | P1         | unit + integração       | C2          | Média              |
| Cards (quebra do monólito)        | M2             | P1         | E2E + component         | C1          | Alta               |

---

## ETAPA O — Plano de Validação Pós-Implementação (único)

**Aplicado somente após todas as implementações do Lovable.**

**Validações obrigatórias:**

1. Suíte unit da lib **verde** (baseline 421) + novos testes de cada onda.
2. **E2E das 5+ jornadas críticas** verdes (TST-001).
3. **Testes de integração de dados** verdes (TST-002).
4. Acesso por papel: leitura anônima às tabelas de negócio **retorna vazio**; GM vê tudo; comum vê seu escopo (SEC-002).
5. Token forjado **rejeitado** (SEC-001).
6. `tsc` estrito **limpo** nas áreas religadas (QC-001).
7. CI **verde** como gate (OPS-001); erro proposital **capturado** no Sentry (OPS-002).
8. Banco recriável do zero a partir do repositório (DB-003); backup restaurável (OPS-006).
9. Filtro de empresa **altera dados** comprovadamente (EST-002).
10. Zero `select("*")` em listas; zero `window.confirm`; um toast; uma moeda; uma data (varreduras).

**Critérios de aprovação:** todos os itens 1–10 satisfeitos + nenhuma jornada crítica em regressão + baselines de performance (789/791/674 kB) reduzidos ou justificados.
**Critérios de rejeição:** qualquer jornada crítica vermelha; qualquer leitura anônima retornando dado de negócio; token forjado aceito; CI não-bloqueante; perda de paridade funcional em módulo migrado.

---

## ETAPA P — Governança da Execução

- **Ordem de implementação:** estritamente por ondas (0→7); dentro da onda, quick wins e paralelizáveis primeiro; cirurgias só com a rede de testes correspondente pronta.
- **Controle de mudanças:** cada implementação referencia o **ID do achado** no commit/PR; nenhuma mudança sem ID rastreável à auditoria; mudança que exceda o escopo do achado vira nota, não escopo silencioso.
- **Gestão de riscos:** achados de regressão **Muito Alta** (auth, RLS, god-context, DP) exigem teste de caracterização **antes** (regra dura da Etapa 12); execução em lotes com validação por lote.
- **Aprovação de cada onda:** critérios de conclusão da onda (§J) + marco (§K) atingidos + suíte verde; sem aprovação da onda anterior, a seguinte não inicia (exceto paralelismos declarados).
- **Evitar retrabalho:** respeitar as fusões em cirurgia única (ARC-005+PERF-001; DS-010+PERF-002; DS-001+BIZ-003); não tocar legado antes de ARC-001/ARC-002 conforme dependências.
- **Rastreabilidade Auditoria↔Implementação:** o Catálogo Mestre (IDs permanentes, nunca reutilizados) é a fonte única; cada PR cita ID; cada onda encerra com checklist de IDs concluídos; o Plano de Validação (§O) fecha o ciclo.

---

## ETAPA Q — RELATÓRIO EXECUTIVO FINAL

**1. Visão geral da auditoria.** Treze etapas de diagnóstico técnico sobre o Planifik (ERP de construção/montagem, React+TypeScript+Supabase com backend PHP legado), cobrindo produto, UX, arquitetura, design system, regras de negócio, estado, dados, código, performance, segurança, testes e operação. Uma conclusão atravessa todas: **fundação boa, adoção parcial** — o produto quase sempre construiu o mecanismo certo e o aplicou pela metade, com a "fronteira dupla de backend" (PHP↔Supabase) como causa-raiz recorrente.

**2. Total de Achados: 107.**

**3. Distribuição por categoria:** PRO 31 · DS 16 · ARC 11 · UX 10 · SEC 7 · OPS 7 · DB 6 · BIZ 4 · QC 4 · PERF 4 · TST 4 · EST 3.

**4. Distribuição por prioridade:** **P0 4 · P1 42 · P2 38 · P3 23.**

**5. Distribuição por criticidade de negócio:** C0 ~6 (segurança/E2E de dinheiro) · C1 ~40 · C2 ~40 · C3 ~21 (derivada por herança da Etapa B).

**6. Distribuição por complexidade:** Baixa ~34 (quick wins) · Média ~46 · Alta ~21 · Muito Alta ~6 (auth, god-context, RLS, monólitos, estado, DP).

**7. Principais riscos.** Exposição de dados (auth forjável + RLS permissivo + segredo no código); execução de cirurgias P0 sem rede de testes; perda de dados-mestre do host; migração PHP→Supabase travar no god-context.

**8. Principais oportunidades.** Cada P0 de segurança **acelera** a migração já planejada; a lib pura testada prova que o time sabe fazer certo; os mecanismos certos já existem (RLS rico, Sentry, flags, telemetria) — falta ligá-los e estendê-los.

**9. Quick Wins: 17** (§G) — contenção de segurança, CI, Sentry, backup, filtro de empresa, e padronizações de toast/moeda/data/status, mais valor de produto barato (motivo de perda, cotação→OC).

**10. Grandes Refatorações: 7 frentes** (§H) — auth+RLS, god-context+estado, monólitos+chunks, validação, DP, conciliação financeira.

**11. Roadmap Executivo: 8 ondas** (0–7), de Contenção a Produto/Operação plena (§J).

**12. Marcos: 8** (§K), de "Exposição contida" a "Pronto para produção/comercialização".

**13. Estratégia de implementação.** Conter → religar redes (tipos, CI, testes) → segurança → dados → padronização → regras → refatorações estruturais → produto/operação. Fusão de cirurgias que tocam os mesmos arquivos; paralelismo máximo nos quick wins; testes de caracterização antes de cada mudança de alto risco.

**14. Estratégia de validação.** Plano único (§O) executado após todas as implementações: suíte verde + E2E das jornadas + acesso por papel + token forjado rejeitado + CI/backup/schema comprovados; critérios objetivos de aprovação/rejeição.

**15. Conclusão Executiva.** O Planifik é um produto **funcionalmente forte e tecnicamente promissor, hoje travado por dívidas concentradas e endereçáveis** — não por defeitos difusos. A modelagem de dados é excelente, os módulos de engenharia competem com software especializado, a lib de negócio é testada, e a plataforma de operação está semiconstruída. O que o separa de um ERP comercializável de nível enterprise não é reescrita: é **terminar de aplicar o que já foi projetado** — fechar a segurança, aposentar o legado, ligar as luzes de operação e padronizar o que ficou pela metade. Os 107 achados estão priorizados, sequenciados, sem conflitos, com critérios de aceite verificáveis e rastreabilidade total por ID. **A fase de Auditoria e Planejamento está encerrada; o programa está pronto para execução pelo Lovable, onda a onda, com validação objetiva a cada marco.**

---

_Consolidação final conforme metodologia da Etapa 5.5. Nenhum novo achado, nenhum diagnóstico alterado, nenhuma auditoria reaberta. Catálogo Mestre: 107 achados, IDs permanentes e rastreáveis. Este documento é a entrada oficial da fase de Execução._
