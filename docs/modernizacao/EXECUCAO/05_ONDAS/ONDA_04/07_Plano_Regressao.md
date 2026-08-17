# Onda 4 — Plano de Regressão

## Resumo Executivo

O que deve ser reexecutado após a onda, com o nível de regressão esperado. Nenhuma jornada crítica pode ficar vermelha.

## Objetivo

Detectar regressão antes da aprovação da onda.

## Escopo

Fluxos, módulos e tipos de teste específicos desta onda, somados à suíte global.

## Conteúdo

### Regressão específica da Onda 4

| Fluxo / Verificação                       | Módulos     | Tipo de teste     | Nível de regressão |
| ----------------------------------------- | ----------- | ----------------- | ------------------ |
| Totais e somatórios das listas paginadas  | M8, M3, M2  | Unit + integração | Médio              |
| Feedback de erro e confirmação destrutiva | Transversal | E2E + manual      | Baixo              |
| Ordenação e filtros das tabelas migradas  | Transversal | E2E               | Médio              |

### Regressão global (sempre)

- Suíte unit completa — baseline **421 testes verdes**.
- E2E das jornadas críticas:
  - Login → acesso a qualquer módulo
  - Mobilização de equipe e frota (M1)
  - Requisição → cotação → OC → recebimento (M7)
  - Medição → faturamento → recebimento (M3/M8)
  - Importação TOTVS → conciliação (M8)
  - Captura de inspeção offline → sync (M5/M6)
- CI verde (install + build + test + lint + typecheck).

### Critério de rejeição

Qualquer jornada crítica vermelha, ou qualquer perda de paridade funcional em módulo tocado, **reprova a onda**.

## Conclusão

Regressão aprovada é pré-condição do [Checklist de Conclusão](10_Checklist_Conclusao.md).

## Referências

- [Matriz de Regressão](../../04_VALIDACAO/Matriz_Regressao.xlsx) · [Plano de Validação](../../04_VALIDACAO/Plano_Validacao.md)

---

**Navegação:** [← Onda 3](../ONDA_03/README.md) · [Índice de Ondas](../) · [Onda 5 →](../ONDA_05/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
