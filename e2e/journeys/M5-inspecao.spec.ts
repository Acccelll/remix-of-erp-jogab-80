import { test, expect } from "@playwright/test";

/**
 * M5 — Inspeção de qualidade: caracterização da agenda de inspeções.
 */
test("agenda de inspeções carrega para usuário autenticado", async ({ page }) => {
  await page.goto("/inspecoes/agenda");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/404|não encontrada/i)).toHaveCount(0);
});
