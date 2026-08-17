# Onda 5 — Plano de Regressão

## Resumo Executivo

O que deve ser reexecutado após a onda, com o nível de regressão esperado. Nenhuma jornada crítica pode ficar vermelha.

## Objetivo

Detectar regressão antes da aprovação da onda.

## Escopo

Fluxos, módulos e tipos de teste específicos desta onda, somados à suíte global.

## Conteúdo

### Regressão específica da Onda 5

| Fluxo / Verificação                        | Módulos     | Tipo de teste                     | Nível de regressão |
| ------------------------------------------ | ----------- | --------------------------------- | ------------------ |
| Validação idêntica entre tela e importador | 5 entidades | Unit + integração                 | Médio              |
| Curva/EVM nas três telas da obra           | M3          | Unit                              | Médio              |
| Números de conciliação e three-way match   | M8, M7      | Integração + conferência paralela | Alto               |

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

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
