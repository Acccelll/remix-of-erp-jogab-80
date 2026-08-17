# Taxonomia de Prioridades, Criticidade, Tipos e Estratégias

## Resumo Executivo

As quatro dimensões de classificação usadas nos 107 Achados, com definição, distribuição e critério de uso.

## Objetivo

Permitir leitura consistente do Catálogo Mestre e das matrizes.

## Escopo

Prioridade técnica, criticidade de negócio, tipo de implementação, estratégia de execução, complexidade e valor esperado.

## Conteúdo

### Prioridade Técnica

| Nível  | Definição                                                                                       | Quantidade |
| ------ | ----------------------------------------------------------------------------------------------- | ---------- |
| **P0** | Bloqueador. Exposição material ou pré-requisito de tudo. Executa antes de qualquer outra coisa. | 4          |
| **P1** | Estrutural. Alto impacto em segurança, manutenção ou valor de produto.                          | 42         |
| **P2** | Consolidação. Melhora consistência, escala ou operação.                                         | 38         |
| **P3** | Higiene e evolução. Baixo custo individual; sinalização de qualidade.                           | 23         |

### Criticidade de Negócio

| Nível  | Definição                                                          |
| ------ | ------------------------------------------------------------------ |
| **C0** | Risco existencial: exposição de dados, fluxo de dinheiro sem rede. |
| **C1** | Impacto direto em operação, custo ou sustentação.                  |
| **C2** | Impacto em consistência, experiência ou escala.                    |
| **C3** | Impacto marginal; qualidade de longo prazo.                        |

### Tipo de Implementação

| Tipo    | Significado                                  |
| ------- | -------------------------------------------- |
| **REF** | Refatoração de código ou estrutura existente |
| **STD** | Padronização / criação de convenção          |
| **CON** | Consolidação (decisão + documentação)        |
| **MIG** | Migração de dados ou de plataforma           |
| **NEW** | Nova funcionalidade ou capacidade            |
| **REM** | Remoção de código morto ou risco             |
| **DOC** | Documentação                                 |
| **MOD** | Modernização de comportamento ou interface   |

### Estratégia de Execução

| Estratégia     | Significado                                          |
| -------------- | ---------------------------------------------------- |
| **ISOLADA**    | Executa sozinha, sem coordenação                     |
| **LOTE**       | Varredura por lotes (arquivo a arquivo, tela a tela) |
| **SEQUENCIAL** | Exige ordem estrita com outros achados               |
| **GLOBAL**     | Atinge toda a base; executa por ondas internas       |
| **MIGRAÇÃO**   | Transição de plataforma/dados, reversível por lote   |

### Complexidade

`Baixa` · `Média` · `Alta` · `Muito Alta` — esforço relativo de implementação, não de diagnóstico.

### Valor Esperado

`SEC` segurança · `PERF` performance · `MAN` manutenibilidade · `SCAL` escalabilidade · `CONS` consistência · `UX` experiência · `QUAL` qualidade · `TEST` testabilidade · `OBS` observabilidade.

## Conclusão

Prioridade responde "quando"; criticidade responde "quanto custa errar"; tipo e estratégia respondem "como".

## Referências

- [Glossário](Glossario.md) · [Catálogo Mestre](../../EXECUCAO/02_CATALOGO/Catalogo_Mestre.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
