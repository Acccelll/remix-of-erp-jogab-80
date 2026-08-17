# Plano de Validação Pós-Implementação

> ⚠️ **Aplicado somente após TODAS as implementações do Lovable.** Não é o checklist de onda — é o gate final da modernização.

## Resumo Executivo

Dez critérios objetivos de aprovação, com critérios de rejeição explícitos. Consolidados das Etapas 12 (Matriz de Validação) e 14 (§O).

## Objetivo

Determinar, sem subjetividade, se a modernização está concluída.

## Escopo

Validações obrigatórias, testes críticos, fluxos críticos, critérios de aprovação e de rejeição.

## Conteúdo

### Validações obrigatórias

| #   | Validação                              | Como verificar                                                                             | Origem                                                              |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Suíte unit da lib verde                | baseline **421 testes**; + novos testes de cada onda                                       | [Etapa 12](../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md) |
| 2   | E2E das jornadas críticas verde        | ≥5 jornadas cobertas e determinísticas                                                     | TST-001                                                             |
| 3   | Testes de integração de dados verdes   | repositories e mappers cobertos                                                            | TST-002                                                             |
| 4   | Acesso por papel correto               | **leitura anônima às tabelas de negócio retorna vazio**; GM vê tudo; comum vê seu escopo   | SEC-002                                                             |
| 5   | Token forjado rejeitado                | montar token base64 com `exp` futuro → acesso negado                                       | SEC-001                                                             |
| 6   | `tsc` estrito limpo                    | `--noEmit` sem erros nas áreas religadas                                                   | QC-001                                                              |
| 7   | CI verde como gate + Sentry capturando | commit vermelho bloqueado; erro proposital aparece com release                             | OPS-001, OPS-002                                                    |
| 8   | Banco recriável e backup restaurável   | provisionar banco vazio só do repositório; restaurar backup do MySQL                       | DB-003, OPS-006                                                     |
| 9   | Filtro de empresa altera dados         | usuário com 2 empresas vê conjuntos distintos                                              | EST-002                                                             |
| 10  | Varreduras limpas                      | zero `select("*")` em listas; zero `window.confirm`; um toast; uma moeda; uma data; um EVM | DS/PERF/BIZ                                                         |

### Fluxos críticos (reexecutar todos)

1. Login → acesso a qualquer módulo
2. Mobilização de equipe e frota (M1)
3. Requisição → cotação → OC → recebimento (M7)
4. Medição → faturamento → recebimento (M3/M8)
5. Importação TOTVS → conciliação (M8)
6. Captura de inspeção offline → sync (M5/M6)

### Critérios de APROVAÇÃO

- [ ] Os **10** itens acima satisfeitos.
- [ ] **Nenhuma** jornada crítica em regressão.
- [ ] Baselines de performance reduzidos ou justificados (entry 789 kB · CardGenericoDialog 791 kB · FinObraDetalhe 674 kB).
- [ ] Os 8 marcos (M1–M8) tagueados.
- [ ] Os 107 IDs concluídos ou formalmente reclassificados com justificativa.

### Critérios de REJEIÇÃO (qualquer um reprova)

- ⛔ Qualquer jornada crítica vermelha.
- ⛔ Qualquer leitura anônima retornando dado de negócio.
- ⛔ Token forjado aceito.
- ⛔ CI não-bloqueante.
- ⛔ Perda de paridade funcional em módulo migrado.

## Conclusão

Aprovação é binária e verificável. Um único critério de rejeição reprova a modernização, independentemente do progresso nos demais.

## Referências

- [Matriz de Regressão](Matriz_Regressao.xlsx) · [Checklist Final](Checklist_Final.md) · [Contrato](../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
