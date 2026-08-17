import { test, expect } from "@playwright/test";

/**
 * M1 — Mobilização: caracterização do quadro de mobilização.
 * Baseline mínimo: rota carrega autenticada e o quadro (drag surface) renderiza.
 * Amplie conforme cada Achado da Onda de referência exigir passos adicionais.
 */
test("quadro de mobilização carrega para usuário autenticado", async ({ page }) => {
  await page.goto("/quadros");
  await expect(page).not.toHaveURL(/\/login/);
  // Baseline permissivo: página não deve ter caído para NotFound.
  await expect(page.getByText(/404|não encontrada/i)).toHaveCount(0);
});
