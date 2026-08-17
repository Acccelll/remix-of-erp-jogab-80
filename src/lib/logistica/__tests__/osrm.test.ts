import { afterEach, describe, expect, it, vi } from "vitest";
import { rotaComFallback, rotaEmLinhaReta, rotaOsrm } from "@/lib/logistica/osrm";

const SALVADOR = { lat: -12.9718, lng: -38.5011 };
const CAMACARI = { lat: -12.6996, lng: -38.3263 };

const respostaOsrm = (overrides: Record<string, unknown> = {}) => ({
  code: "Ok",
  routes: [
    {
      distance: 52_000,
      duration: 3_000,
      geometry: {
        type: "LineString",
        coordinates: [
          [-38.5011, -12.9718],
          [-38.42, -12.85],
          [-38.3263, -12.6996],
        ],
      },
      ...overrides,
    },
  ],
});

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("logistica · rotaEmLinhaReta", () => {
  it("liga origem e destino e marca como estimada", () => {
    const rota = rotaEmLinhaReta(SALVADOR, CAMACARI);
    expect(rota.estimada).toBe(true);
    expect(rota.geometry.coordinates).toEqual([
      [SALVADOR.lng, SALVADOR.lat],
      [CAMACARI.lng, CAMACARI.lat],
    ]);
    expect(rota.distanciaKm).toBeCloseTo(36, 0);
    expect(rota.duracaoMin).toBeGreaterThan(0);
  });
});

describe("logistica · rotaOsrm", () => {
  it("converte metros/segundos em km/minutos e preserva o traçado", async () => {
    mockFetch(respostaOsrm());

    const rota = await rotaOsrm(SALVADOR, CAMACARI);

    expect(rota).not.toBeNull();
    expect(rota!.distanciaKm).toBe(52);
    expect(rota!.duracaoMin).toBe(50);
    expect(rota!.estimada).toBe(false);
    expect(rota!.geometry.coordinates).toHaveLength(3);
  });

  it("monta a URL no formato lng,lat esperado pelo OSRM", async () => {
    const fetchMock = mockFetch(respostaOsrm());

    await rotaOsrm(SALVADOR, CAMACARI);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/route/v1/driving/");
    expect(url).toContain(`${SALVADOR.lng},${SALVADOR.lat};${CAMACARI.lng},${CAMACARI.lat}`);
    expect(url).toContain("geometries=geojson");
  });

  it("devolve null quando o serviço responde erro HTTP", async () => {
    mockFetch({}, false);
    expect(await rotaOsrm(SALVADOR, CAMACARI)).toBeNull();
  });

  it("devolve null quando não há rota terrestre", async () => {
    mockFetch({ code: "NoRoute", routes: [] });
    expect(await rotaOsrm(SALVADOR, CAMACARI)).toBeNull();
  });

  it("devolve null quando a geometria vem degenerada", async () => {
    mockFetch(respostaOsrm({ geometry: { type: "LineString", coordinates: [[-38.5, -12.9]] } }));
    expect(await rotaOsrm(SALVADOR, CAMACARI)).toBeNull();
  });

  it("devolve null quando distância/duração não são numéricas", async () => {
    mockFetch(respostaOsrm({ distance: null, duration: null }));
    expect(await rotaOsrm(SALVADOR, CAMACARI)).toBeNull();
  });

  it("não lança quando a rede falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(rotaOsrm(SALVADOR, CAMACARI)).resolves.toBeNull();
  });
});

describe("logistica · rotaComFallback", () => {
  it("usa a rota real quando disponível", async () => {
    mockFetch(respostaOsrm());
    const rota = await rotaComFallback(SALVADOR, CAMACARI);
    expect(rota.estimada).toBe(false);
    expect(rota.distanciaKm).toBe(52);
  });

  it("cai para a linha reta quando o OSRM falha, sem lançar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const rota = await rotaComFallback(SALVADOR, CAMACARI);

    expect(rota.estimada).toBe(true);
    expect(rota.distanciaKm).toBeCloseTo(36, 0);
    expect(rota.geometry.coordinates).toHaveLength(2);
  });
});
