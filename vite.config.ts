import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig({
  plugins: [react(), mcpPlugin()],

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      // TST-004: medição de cobertura habilitada.
      // Threshold NÃO é obrigatório nesta onda — só medição.
      // Threshold obrigatório entra em OPS-001.b/QC-001 (Onda 1).
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/integrations/supabase/types.ts",
        "src/integrations/supabase/client.ts",
        "src/components/ui/**",
        "server/**",
        "supabase/**",
        "docs/**",
        "ops/**",
      ],
      all: true,
      clean: true,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
