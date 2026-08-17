import { test, expect } from "@playwright/test";

/**
 * M7 — Suprimentos: caracterização da tela de requisições.
 */
test("requisições de suprimentos carregam para usuário autenticado", async ({ page }) => {
  await page.goto("/suprimentos/requisicoes");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText(/404|não encontrada/i)).toHaveCount(0);
});
