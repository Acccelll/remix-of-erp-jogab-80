# Decisão — wave-2-formal-open-01

Autor: Cappucceno
Data: 2026-07-12T00:00:00Z

## Justificativa

- PC1..PC6 já possuem evidência documental e dry-run verde no verificador de pré-condições da Onda 2.
- PC7 formaliza a decisão executiva mínima exigida antes de qualquer apply de abertura formal.
- A decisão é documental, não executa produção e mantém a abertura da Onda 2 dependente de apply separado.

## Restrições

- Não abre a Onda 2.
- Não altera workflow, apply-map, `INDEX.md`, `src/**`, `supabase/**` ou dados.
- Não substitui o apply formal de abertura; apenas satisfaz `E_WAVE2_PC7`.