# 02 — Roadmap Executivo

## Resumo Executivo

Programa em ondas sequenciais: 0–7 encerram a modernização funcional original; a Onda 8 foi aberta em **KICKOFF** para débitos formalmente diferidos de integrações externas. Da contenção da exposição à operação plena e integrações governadas.

## Objetivo

Dar a visão macro do caminho e dos marcos verificáveis.

## Escopo

Ondas, marcos, esforço relativo e cadeias de dependência.

## Conteúdo

### As ondas

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
| **8** | Integrações Externas            | Executar débitos diferidos dependentes de sistemas externos e patrocinador. | 5       | A dimensionar | M9    |

### Marcos

| Marco | Descrição                                | Alcançado ao concluir |
| ----- | ---------------------------------------- | --------------------- |
| M1    | Exposição contida                        | Onda 0                |
| M2    | Fundação técnica consolidada             | Onda 1                |
| M3    | Segurança consolidada                    | Onda 2                |
| M4    | Dados e camadas consolidados             | Onda 3                |
| M5    | Design System consolidado                | Onda 4                |
| M6    | Regras e fluxo financeiro consolidados   | Onda 5                |
| M7    | Arquitetura consolidada                  | Onda 6                |
| M8    | Produto e operação prontos para produção | Onda 7                |
| M9    | Integrações externas em produção com observabilidade | Onda 8                |

### Cadeias de dependência (mapa simplificado)

```
[Onda 0] SEC-003 · xlsx · OPS-001.a · OPS-002 · OPS-006.a · TST-004 · TST-001.a · EST-002 → UX-004
                                   ↓
[Onda 1] ARC-001 → QC-001/002 · ARC-009 · DB-005 · DB-003 · higiene · OPS-001.b
              ↓                              ↓
[Onda 2] SEC-001(+005) → SEC-002 → SEC-004 → SEC-007
                                             [Onda 3] ARC-003 + BIZ-002 + TST-002 · DB-001/004 · EST-001
                                   ↓
[Onda 4] Padronização DS · DS-010 + PERF-002 · QC-003 · UX-001
                                   ↓
[Onda 5] DS-001 + BIZ-003 · BIZ-001 · PRO-013 → PRO-011 → PRO-014
                                   ↓
[Onda 6] ARC-005 + PERF-001 + DS-011/016 → ARC-002 + ARC-004 → PRO-004 · PERF-003
                                   ↓
[Onda 7] PRO/UX restantes · OPS-003/004/005 · OPS-007
   ↓
[Onda 8] PRO-008 f2 · PRO-010 f2 · PRO-015 f2 · PRO-017 · PRO-026 opcional
```

### Quick Wins (23)

Entregas de baixo risco, baixa complexidade e alto retorno, sem dependência de cirurgias:

| ID       | Título                                                                       | Onda |
| -------- | ---------------------------------------------------------------------------- | ---- |
| EST-002  | Escopo multiempresa não flui para os dados (filtro não filtra)               | 0    |
| OPS-001  | Ausência de CI (gate de qualidade antes do deploy)                           | 0    |
| OPS-002  | Error tracking desligado na prática (Sentry não instalado)                   | 0    |
| OPS-006  | Backup do host MySQL e rollback de schema não evidenciados                   | 0    |
| SEC-003  | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto     | 0    |
| TST-004  | Ausência de medição de cobertura                                             | 0    |
| ARC-006  | Inversões de camada: lib/schemas -> ui; component -> page                    | 1    |
| ARC-011  | 4 páginas órfãs (Index, Ocorrencias, LicoesAprendidas, Riscos)               | 1    |
| DB-005   | Entidades espelhadas entre bancos sem canonicidade declarada                 | 1    |
| DS-013   | Peças mortas/presas: ui/form, ui/drawer, ui/chart; EmptyState em obra/       | 1    |
| BIZ-004  | Datas sem módulo central (48 arquivos formatam inline)                       | 4    |
| DS-002   | Dois sistemas de toast (sonner x84 / use-toast x9)                           | 4    |
| DS-003   | window.confirm nativo em 5 telas                                             | 4    |
| DS-005   | Mapas status->rótulo/cor duplicados em 15 arquivos                           | 4    |
| DS-006   | Moeda sem fonte única (BRL inline em 32 páginas; money x currency)           | 4    |
| PERF-004 | Fontes de terceiro no caminho crítico de render                              | 7    |
| PRO-001  | CRM: motivo de perda não capturado                                           | 7    |
| PRO-009  | Suprimentos: fluxo cotação vencedora -> OC não conduzido                     | 7    |
| PRO-018  | Importador BMS frágil a variações de layout (plano canônico pendente)        | 7    |
| PRO-019  | Contratos: sem alertas de vencimento/renovação                               | 7    |
| PRO-023  | Board: sem mobilização em massa (seleção múltipla)                           | 7    |
| PRO-029  | Qualidade: sem relatório PDF de inspeção para cliente/auditoria              | 7    |
| UX-003   | Rótulos analíticos indistintos na Obra 360 (Desempenho x Previsão x Análise) | 7    |

## Conclusão

O roadmap privilegia **conter antes de construir**. A Onda 8 só avança após M8, aprovação formal da Onda 7 e decisão D-10 para evitar integrar sistemas externos sem contrato operacional.

## Referências

- [Visão Geral](01_VISAO_GERAL.md) · [Plano Mestre](../../EXECUCAO/00_EXECUTIVO/03_PLANO_MESTRE_EXECUCAO.md) · [Ondas](../../EXECUCAO/05_ONDAS/)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
