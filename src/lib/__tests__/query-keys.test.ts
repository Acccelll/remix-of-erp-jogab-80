import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isRegisteredQueryKeyRoot, registeredQueryKeyRoots } from "@/lib/query-keys";

const SRC_DIR = path.resolve(process.cwd(), "src");
const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return CODE_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

function collectLiteralQueryRoots(): string[] {
  const roots = new Set<string>();
  const patterns = [
    /queryKey:\s*\[\s*["']([^"']+)["']/g,
    /queryKey\(\s*["']([^"']+)["']/g,
  ];

  for (const file of walk(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) roots.add(match[1]);
    }
  }

  return Array.from(roots).sort((a, b) => a.localeCompare(b));
}

describe("ARC-008 query key registry", () => {
  it("mantém o registro ordenado e sem duplicatas", () => {
    const sorted = [...registeredQueryKeyRoots].sort();
    expect(registeredQueryKeyRoots).toEqual(sorted);
    expect(new Set(registeredQueryKeyRoots).size).toBe(registeredQueryKeyRoots.length);
  });

  it("cobre todos os prefixos literais de queryKey existentes", () => {
    const missing = collectLiteralQueryRoots().filter((root) => !isRegisteredQueryKeyRoot(root));
    expect(missing).toEqual([]);
  });
});
