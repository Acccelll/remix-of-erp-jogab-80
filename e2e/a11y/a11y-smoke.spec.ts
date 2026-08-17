import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * UX-005 slice-02 — Smoke test de acessibilidade com axe-core.
 *
 * Falha em violações `serious`/`critical` das regras `button-name` e
 * `color-contrast` nas rotas críticas. Serve como rede automatizada
 * para o restante do Achado UX-005 (botões icon-only cuja nomeação
 * depende de children/prop e não é detectável por análise estática).
 *
 * Configurado como projeto opcional em `playwright.config.ts`
 * (`name: "a11y"`); não roda por padrão para não atrasar o e2e de
 * caracterização.
 */

const ROTAS = [
  "/",
  "/quadros",
  "/obras",
  "/planejamento/riscos",
  "/gm/security-events",
];

const REGRAS_BLOQUEANTES = ["button-name", "color-contrast"];

for (const rota of ROTAS) {
  test(`axe smoke: ${rota}`, async ({ page }) => {
    await page.goto(rota, { waitUntil: "domcontentloaded" });
    // Espera básica por hidratação — o layout é reactivo.
    await page.waitForLoadState("networkidle").catch(() => undefined);

    const results = await new AxeBuilder({ page })
      .withRules(REGRAS_BLOQUEANTES)
      .analyze();

    const violacoes = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );

    if (violacoes.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          violacoes.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => n.target).slice(0, 5),
          })),
          null,
          2,
        ),
      );
    }
    expect(violacoes, `Violacoes em ${rota}`).toEqual([]);
  });
}
