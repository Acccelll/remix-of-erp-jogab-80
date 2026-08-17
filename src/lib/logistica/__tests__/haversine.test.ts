import { describe, expect, it } from "vitest";
import { distanciaKm, duracaoEstimadaMin, pontoMedio } from "@/lib/logistica/haversine";

// Coordenadas do dataset IBGE embarcado.
const SALVADOR = { lat: -12.9718, lng: -38.5011 };
const CAMACARI = { lat: -12.6996, lng: -38.3263 };
const SAO_PAULO = { lat: -23.5329, lng: -46.6395 };
const RIO = { lat: -22.9129, lng: -43.2003 };
const MANAUS = { lat: -3.1019, lng: -60.025 };

describe("logistica · distanciaKm", () => {
  it("mede distâncias curtas conhecidas", () => {
    // Salvador → Camaçari: ~36 km em linha reta
    expect(distanciaKm(SALVADOR, CAMACARI)).toBeCloseTo(36, 0);
  });

  it("mede distâncias longas conhecidas", () => {
    // São Paulo → Rio: ~357 km em linha reta
    expect(distanciaKm(SAO_PAULO, RIO)).toBeGreaterThan(350);
    expect(distanciaKm(SAO_PAULO, RIO)).toBeLessThan(365);
    // São Paulo → Manaus: ~2.690 km
    expect(distanciaKm(SAO_PAULO, MANAUS)).toBeGreaterThan(2650);
    expect(distanciaKm(SAO_PAULO, MANAUS)).toBeLessThan(2730);
  });

  it("é zero para o mesmo ponto e simétrica", () => {
    expect(distanciaKm(SALVADOR, SALVADOR)).toBe(0);
    expect(distanciaKm(SALVADOR, RIO)).toBeCloseTo(distanciaKm(RIO, SALVADOR), 9);
  });

  it("não devolve NaN em pontos antípodas", () => {
    const d = distanciaKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeCloseTo(20015, -1);
  });
});

describe("logistica · duracaoEstimadaMin", () => {
  it("aplica sinuosidade e velocidade média", () => {
    // 70 km em linha reta → 91 km de rodovia a 70 km/h → 78 min
    expect(duracaoEstimadaMin(70)).toBe(78);
    expect(duracaoEstimadaMin(0)).toBe(0);
  });

  it("cresce monotonicamente com a distância", () => {
    expect(duracaoEstimadaMin(100)).toBeGreaterThan(duracaoEstimadaMin(50));
  });
});

describe("logistica · pontoMedio", () => {
  it("fica entre os dois pontos", () => {
    const meio = pontoMedio(SALVADOR, CAMACARI);
    expect(meio.lat).toBeGreaterThan(SALVADOR.lat);
    expect(meio.lat).toBeLessThan(CAMACARI.lat);
    expect(distanciaKm(SALVADOR, meio)).toBeCloseTo(distanciaKm(meio, CAMACARI), 1);
  });
});
