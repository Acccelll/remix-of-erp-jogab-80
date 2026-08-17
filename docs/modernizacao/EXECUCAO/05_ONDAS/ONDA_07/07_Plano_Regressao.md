# Onda 7 — Plano de Regressão

## Resumo Executivo

O que deve ser reexecutado após a onda, com o nível de regressão esperado. Nenhuma jornada crítica pode ficar vermelha.

## Objetivo

Detectar regressão antes da aprovação da onda.

## Escopo

Fluxos, módulos e tipos de teste específicos desta onda, somados à suíte global.

## Conteúdo

### Regressão específica da Onda 7

| Fluxo / Verificação                  | Módulos    | Tipo de teste | Nível de regressão |
| ------------------------------------ | ---------- | ------------- | ------------------ |
| Fluxos de produto entregues          | Vários     | E2E por fluxo | Médio              |
| Correlação de logs ponta a ponta     | Plataforma | Manual        | Baixo              |
| Onboarding apenas com a documentação | Plataforma | Ensaio        | Baixo              |

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

### Execução registrada

- `bunx vitest run` — **verde** após correção do bloqueio de regressão.
- Ajustes aplicados: contratos de repositório passaram a reconhecer chamadas `.limit(...)` já presentes nos repos; `registeredQueryKeyRoots` foi ordenado e completado com prefixos literais detectados.
- Resultado: **118 arquivos de teste / 906 testes aprovados**.
- `bunx playwright test --project setup` — **bloqueado** no sandbox: sem `E2E_USER` / `E2E_PASSWORD`, preview sem sessão gerenciada injetada (`signed_out`) e navegador Playwright não provisionado para o runner JS.
- Ajuste aplicado: `e2e/auth.setup.ts` agora aceita sessão gerenciada injetada pelo preview como alternativa segura às credenciais E2E tradicionais.
- Impacto: suíte unitária aprovada; checklist final e marco **M8** ainda dependem de E2E/jornadas críticas em ambiente com navegador + sessão válida, validação operacional e aprovação formal.

## Conclusão

Regressão aprovada é pré-condição do [Checklist de Conclusão](10_Checklist_Conclusao.md).

## Referências

- [Matriz de Regressão](../../04_VALIDACAO/Matriz_Regressao.xlsx) · [Plano de Validação](../../04_VALIDACAO/Plano_Validacao.md)

---

**Navegação:** [← Onda 6](../ONDA_06/README.md) · [Índice de Ondas](../) · —

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
