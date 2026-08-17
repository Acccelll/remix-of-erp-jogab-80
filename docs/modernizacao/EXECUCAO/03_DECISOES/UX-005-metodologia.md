# UX-005 — Metodologia de auditoria de nome acessível

**Contexto.** O Achado UX-005 exige que 22 botões icon-only ganhem nome
acessível e que DnD tenha alternativa por teclado.

## Decisão

1. **Botões shadcn (`<Button size="icon">`) — auditoria estática.** Regex
   sobre o repositório detecta ausência de `aria-label`/`aria-labelledby`.
   Método adequado porque o componente é canônico e o atributo aparece
   na própria tag JSX.
   - Estado atual: **0 pendências** (28 já rotulados, 1 corrigido em
     `BoardAutomacoesDialog`).

2. **`<button>` HTML puro — auditoria em runtime via axe-core.** Regex
   não distingue `<button><Icon /></button>` (sem nome) de
   `<button><span>{label}</span></button>` (nome dinâmico via prop).
   Toda análise estática produz falso-positivo em componentes
   reutilizáveis (`SortHeader`, `Layout` groups, `ObraTabs` etc.), que
   recebem texto por `children`/prop.
   - **Padrão exigido:** rodar `@axe-core/playwright` nas rotas críticas
     e falhar CI para regra `button-name` com severidade `serious`.
   - **Trilha de execução:** ver `e2e/` (Playwright já configurado).

3. **DnD acessível — usar `KeyboardSensor` do `@dnd-kit/core`.**
   Configuração em `AllocationBoard` e `QuadroBoard`, com anúncio via
   `aria-live` para movimentos. Não é possível cobrir com regex; testar
   com axe + teste de teclado.

## Fora de escopo desta decisão

- Auditoria de contraste (WCAG SC 1.4.3) — cobre-se via
  `@axe-core/playwright` na mesma execução, mas segue Achado próprio.
- Textos alternativos de imagem — a app não expõe imagens de conteúdo
  fora de logotipos decorativos.

## Referências

- [Onda 07 — Achado UX-005](../05_ONDAS/ONDA_07/02_Achados.md)
- [Skill accessibility (Lovable)](../../../../.workspace/skills/accessibility/SKILL.md)
- [`@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright)
