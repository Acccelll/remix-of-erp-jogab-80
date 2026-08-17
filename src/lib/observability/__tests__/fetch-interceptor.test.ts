import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installFetchInterceptor,
  __uninstallFetchInterceptorForTests,
} from "../fetch-interceptor";
import {
  __resetCorrelationForTests,
  withCorrelation,
} from "../correlation";
import {
  __resetSinksForTests,
  addSink,
  type StructuredEvent,
} from "../structured-logger";

let originalFetch: typeof fetch;

beforeEach(() => {
  __resetCorrelationForTests();
  __resetSinksForTests();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  __uninstallFetchInterceptorForTests();
  globalThis.fetch = originalFetch;
});

function mockFetch(responder: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(responder);
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

describe("fetch-interceptor", () => {
  it("adiciona X-Correlation-Id em URLs alvo (path includes)", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    installFetchInterceptor({ matchPathIncludes: ["/functions/v1/"] });

    await withCorrelation("cor_top", async () => {
      await fetch("https://example.com/functions/v1/hello");
    });

    const [, init] = spy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Correlation-Id")).toBe("cor_top");
  });

  it("não intercepta URLs fora do alvo", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    installFetchInterceptor({ matchPathIncludes: ["/functions/v1/"] });

    await fetch("https://outra.com/rota");

    const [, init] = spy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-Correlation-Id")).toBeNull();
  });

  it("gera id efêmero quando não há contexto", async () => {
    mockFetch(async () => new Response("{}", { status: 200 }));
    installFetchInterceptor({ matchPathIncludes: ["/api/"] });

    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    await fetch("https://x.com/api/ping");

    expect(capturados[0].correlationId).toMatch(/^sb_/);
  });

  it("emite http_error em status >= 400", async () => {
    mockFetch(async () => new Response("nope", { status: 500 }));
    installFetchInterceptor({ matchPathIncludes: ["/api/"] });

    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    await fetch("https://x.com/api/oops");

    expect(capturados[0].event).toBe("sb.fetch.http_error");
    expect(capturados[0].fields?.status).toBe(500);
  });

  it("emite fail em rede caída e propaga o erro", async () => {
    mockFetch(async () => {
      throw new Error("network down");
    });
    installFetchInterceptor({ matchPathIncludes: ["/api/"] });

    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    await expect(fetch("https://x.com/api/oops")).rejects.toThrow("network down");
    expect(capturados[0].event).toBe("sb.fetch.fail");
  });

  it("instalação é idempotente", async () => {
    const spy = mockFetch(async () => new Response("{}", { status: 200 }));
    installFetchInterceptor({ matchPathIncludes: ["/api/"] });
    installFetchInterceptor({ matchPathIncludes: ["/api/"] });

    await fetch("https://x.com/api/ping");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
