import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";

import { APP_PROVIDERS, comporProviders } from "@/contexts/AppProviders";
import {
  createRequiredContext,
  providersMontados,
  useProviderMounted,
  useRequiredContext,
} from "@/contexts/createRequiredContext";

/**
 * O que este arquivo protege:
 *
 *  1. Completude — todo provider exportado em `src/contexts/**` está em
 *     `APP_PROVIDERS`. Um refactor que remova um wrapper (foi o que quebrou
 *     `useColaboradoresContext`/`useDocumentosContext` em produção) reprova aqui,
 *     e não na tela do usuário.
 *  2. Ordem — camadas de estado antes da fachada, fachada antes dos derivados.
 *  3. Diagnóstico — chamar um hook fora do provider diz QUAL provider falta,
 *     em qual arquivo ele mora e quem estava montado no momento.
 */

const CONTEXTS_DIR = path.resolve(__dirname, "..");

/** Providers exportados por `src/contexts/**`, lidos do próprio código-fonte. */
function providersExportados(): string[] {
  const encontrados = new Set<string>();
  const visitar = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        visitar(full);
        continue;
      }
      if (!entry.name.endsWith(".tsx")) continue;
      if (entry.name === "AppProviders.tsx") continue;
      const src = fs.readFileSync(full, "utf8");
      for (const m of src.matchAll(/export (?:const|function) (\w+Provider)\b/g)) {
        encontrados.add(m[1]);
      }
    }
  };
  visitar(CONTEXTS_DIR);
  return [...encontrados].sort();
}

describe("APP_PROVIDERS", () => {
  it("contém todos os providers exportados em src/contexts", () => {
    const registrados = new Set(APP_PROVIDERS.map((p) => p.nome));
    const ausentes = providersExportados().filter((nome) => !registrados.has(nome));
    expect(
      ausentes,
      `Providers fora da composição canônica (src/contexts/AppProviders.tsx): ${ausentes.join(", ")}`,
    ).toEqual([]);
  });

  it("não repete provider", () => {
    const nomes = APP_PROVIDERS.map((p) => p.nome);
    expect(nomes).toEqual([...new Set(nomes)]);
  });

  it("mantém a ordem das camadas: estado → fachada → derivados", () => {
    const pos = (nome: string) => APP_PROVIDERS.findIndex((p) => p.nome === nome);
    const fachada = pos("AppProvider");

    // A fachada lê os donos do estado; todos precisam estar acima dela.
    for (const estado of APP_PROVIDERS.map((p) => p.nome).filter((n) =>
      n.endsWith("StateProvider"),
    )) {
      expect(pos(estado), `${estado} deve ficar acima de AppProvider`).toBeLessThan(fachada);
    }
    expect(pos("AuthProvider")).toBeLessThan(fachada);
    expect(pos("MobilizacoesProvider")).toBeLessThan(fachada);

    // Estes consomem a fachada (direta ou indiretamente).
    for (const derivado of [
      "ColaboradoresProvider",
      "PatrimoniosProvider",
      "VeiculosProvider",
      "ContratosProvider",
      "ClientesProvider",
      "AuthMethodsProvider",
      "DocumentosProvider",
      "MobilizacoesPendentesProvider",
      "EmpresaProvider",
    ]) {
      expect(pos(derivado), `${derivado} deve ficar abaixo de AppProvider`).toBeGreaterThan(
        fachada,
      );
    }
  });

  it("monta todas as camadas, de fora para dentro, e registra cada uma", () => {
    // Providers inertes com os nomes reais: o alvo aqui é a composição
    // (`comporProviders`), não o conteúdo de cada contexto — montar os de
    // verdade dispararia as queries de todos os domínios.
    const ordem: string[] = [];
    const camadas = APP_PROVIDERS.map(({ nome }) => ({
      nome,
      Component: ({ children }: { children: React.ReactNode }) => {
        ordem.push(nome);
        return <>{children}</>;
      },
    }));

    const { unmount } = render(<>{comporProviders(camadas, <span data-testid="folha" />)}</>);

    expect(screen.getByTestId("folha")).toBeInTheDocument();
    expect(ordem).toEqual(APP_PROVIDERS.map((p) => p.nome));
    // Todos registrados enquanto montados — é essa lista que aparece no
    // diagnóstico quando algum hook não acha seu provider.
    expect(providersMontados()).toEqual([...ordem].sort());
    unmount();
  });
});

describe("diagnóstico de provider ausente", () => {
  const erroSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => erroSpy.mockClear());

  interface Valor {
    ok: boolean;
  }
  const Ctx = createRequiredContext<Valor>({
    hook: "useCtxDeTeste",
    provider: "ProviderDeTeste",
    file: "src/contexts/__tests__/AppProviders.test.tsx",
  });
  const useCtxDeTeste = () => useRequiredContext(Ctx);

  const Consumidor = () => {
    useCtxDeTeste();
    return null;
  };

  it("estoura citando hook e provider quando falta o wrapper", () => {
    expect(() => render(<Consumidor />)).toThrow(
      /useCtxDeTeste must be used within ProviderDeTeste/,
    );
  });

  it("loga provider, arquivo e providers montados no momento do erro", () => {
    const Outro: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      useProviderMounted("OutroProviderMontado");
      return <>{children}</>;
    };

    expect(() =>
      render(
        <Outro>
          <Consumidor />
        </Outro>,
      ),
    ).toThrow();

    const logado = erroSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logado).toContain("ProviderDeTeste");
    expect(logado).toContain("src/contexts/__tests__/AppProviders.test.tsx");
    expect(logado).toContain("OutroProviderMontado");
    expect(logado).toContain("src/contexts/AppProviders.tsx");
  });

  it("entrega o valor quando o provider está presente", () => {
    const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <Ctx.Provider value={{ ok: true }}>{children}</Ctx.Provider>
    );
    const Mostra = () => <span data-testid="v">{String(useCtxDeTeste().ok)}</span>;
    render(
      <Provider>
        <Mostra />
      </Provider>,
    );
    expect(screen.getByTestId("v")).toHaveTextContent("true");
  });

  it("desmontar o provider o tira da lista de montados", () => {
    const Marcado: React.FC = () => {
      useProviderMounted("ProviderEfemero");
      return null;
    };
    const { unmount } = render(<Marcado />);
    expect(providersMontados()).toContain("ProviderEfemero");
    unmount();
    expect(providersMontados()).not.toContain("ProviderEfemero");
  });
});
