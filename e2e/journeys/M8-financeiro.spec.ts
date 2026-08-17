import { test, expect } from "@playwright/test";

/**
 * M8 — Financeiro: caracterização da tela de lançamentos.
 */
test("lançamentos financeiros carregam para usuário autenticado", async ({ page }) => {
  await page.goto("/financeiro/lancamentos");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/404|não encontrada/i)).toHaveCount(0);
});
