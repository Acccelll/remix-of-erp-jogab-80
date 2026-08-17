import { describe, it, expect } from "vitest";
import { fitDimensions, shouldCompress } from "../compress-image";

describe("fitDimensions", () => {
  it("não altera quando já cabe", () => {
    expect(fitDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitDimensions(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it("escala mantendo proporção quando o maior lado excede", () => {
    expect(fitDimensions(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitDimensions(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("arredonda para inteiros e nunca devolve 0", () => {
    const r = fitDimensions(1601, 901, 1600);
    expect(r.width).toBe(1600);
    expect(r.height).toBe(900);
    expect(Number.isInteger(r.width) && Number.isInteger(r.height)).toBe(true);
  });

  it("retorna 0x0 para entradas inválidas", () => {
    expect(fitDimensions(0, 100, 1600)).toEqual({ width: 0, height: 0 });
    expect(fitDimensions(100, -1, 1600)).toEqual({ width: 0, height: 0 });
  });

  it("ignora maxDimension <= 0", () => {
    expect(fitDimensions(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });
});

describe("shouldCompress", () => {
  const blob = (type: string, size: number) => {
    const b = new Blob([new Uint8Array(size)], { type });
    Object.defineProperty(b, "size", { value: size });
    return b as File;
  };

  it("comprime imagens grandes (>200KB)", () => {
    expect(shouldCompress(blob("image/jpeg", 300_000))).toBe(true);
    expect(shouldCompress(blob("image/png", 5_000_000))).toBe(true);
  });

  it("ignora imagens pequenas", () => {
    expect(shouldCompress(blob("image/jpeg", 50_000))).toBe(false);
  });

  it("ignora gif (animação) e svg (vetorial)", () => {
    expect(shouldCompress(blob("image/gif", 5_000_000))).toBe(false);
    expect(shouldCompress(blob("image/svg+xml", 5_000_000))).toBe(false);
  });

  it("ignora não-imagens", () => {
    expect(shouldCompress(blob("application/pdf", 5_000_000))).toBe(false);
  });
});
