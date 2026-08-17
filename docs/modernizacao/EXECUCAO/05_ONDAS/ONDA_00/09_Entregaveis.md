# Onda 0 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Segredo rotacionado e removido do repositório
- Pipeline de CI ativo
- Error tracking em produção
- Backup verificado com restore testado
- Baseline de cobertura
- Suíte E2E de caracterização
- Filtro multiempresa funcional
- Materialização documental dos campos derivados (G-05)

### Achados concluídos

| ID        | Título                                                                   |
| --------- | ------------------------------------------------------------------------ |
| `SEC-003` | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto |
| `EST-002` | Escopo multiempresa não flui para os dados (filtro não filtra)           |
| `OPS-001` | Ausência de CI (gate de qualidade antes do deploy)                       |
| `OPS-002` | Error tracking desligado na prática (Sentry não instalado)               |
| `OPS-006` | Backup do host MySQL e rollback de schema não evidenciados               |
| `TST-001` | Ausência de testes E2E dos fluxos críticos de negócio                    |
| `UX-004`  | Escopo multiempresa silencioso (sem sinalização por tela)                |
| `TST-004` | Ausência de medição de cobertura                                         |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M1** e release com os IDs nas notas.

## Conclusão

Marco **M1 — Exposição contida** alcançado.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
