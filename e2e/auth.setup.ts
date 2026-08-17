import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const STORAGE = path.resolve("e2e/.auth/storageState.json");
const LEGACY_LOCAL_USER = "Cappucceno";
const LEGACY_LOCAL_PASSWORD = "XWWSDZ66";

setup("autentica usuário de teste e grava storageState", async ({ page, context, baseURL }) => {
  const email = process.env.E2E_USER;
  const password = process.env.E2E_PASSWORD;
  const injectedStorageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const injectedSessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const injectedCookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

  fs.mkdirSync(path.dirname(STORAGE), { recursive: true });

  if (injectedStorageKey && injectedSessionJson) {
    if (injectedCookiesJson) {
      const origin = new URL(baseURL ?? "http://localhost:8080").origin;
      const cookies = JSON.parse(injectedCookiesJson).map((cookie: Record<string, unknown>) => {
        const { domain: _domain, ...rest } = cookie;
        return { ...rest, url: origin };
      });
      await context.addCookies(cookies);
    }

    await page.goto("/");
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [injectedStorageKey, injectedSessionJson],
    );
    await page.context().storageState({ path: STORAGE });
    return;
  }

  const loginEmail = email ?? LEGACY_LOCAL_USER;
  const loginPassword = password ?? LEGACY_LOCAL_PASSWORD;

  await page.goto("/login");
  await page.getByLabel(/e-?mail|usuário/i).fill(loginEmail);
  await page.getByLabel(/senha/i).fill(loginPassword);
  await page.getByRole("button", { name: /entrar|login/i }).click();

  // Sucesso = redireciona para fora de /login e o app carrega
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  await page.context().storageState({ path: STORAGE });
});
