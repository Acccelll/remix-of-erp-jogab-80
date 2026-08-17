import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * TST-001.a — E2E de caracterização das jornadas críticas (M1/M5/M7/M8).
 *
 * Objetivo: fotografar o comportamento ATUAL do produto antes de qualquer
 * cirurgia. Não é validação de correção. Falha = mudança de comportamento
 * (regressão ou correção deliberada); nunca "o teste está errado".
 *
 * Autenticação: reusa `e2e/.auth/storageState.json`, produzido pelo projeto
 * `setup` (login via UI contra Lovable Cloud). O storageState fica fora do
 * repo (ver .gitignore).
 */
const PORT = Number(process.env.E2E_PORT ?? 8080);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const CHROMIUM_EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  ["/chromium-1194/chrome-linux/chrome", "/chromium-1140/chrome-linux/chrome"].find((p) =>
    fs.existsSync(p),
  );

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // caracterização é sensível a ordem de sessão
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: CHROMIUM_EXECUTABLE
      ? { executablePath: CHROMIUM_EXECUTABLE, args: ["--headless=new"] }
      : undefined,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "M1-mobilizacao",
      testMatch: /journeys\/M1-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/storageState.json" },
    },
    {
      name: "M5-inspecao",
      testMatch: /journeys\/M5-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/storageState.json" },
    },
    {
      name: "M7-suprimentos",
      testMatch: /journeys\/M7-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/storageState.json" },
    },
    {
      name: "M8-financeiro",
      testMatch: /journeys\/M8-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/storageState.json" },
    },
    {
      // UX-005 slice-02 — auditoria a11y com axe-core.
      // Rodar via: `bunx playwright test --project a11y`.
      name: "a11y",
      testMatch: /a11y\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/storageState.json" },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
