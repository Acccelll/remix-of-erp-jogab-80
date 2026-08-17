import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBmsWorkbook } from "../bms/excel";

function loadFile(name: string): File {
  const buf = readFileSync(resolve(__dirname, "fixtures", name));
  const u8 = new Uint8Array(buf);
  return {
    arrayBuffer: async () => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength),
    name,
  } as unknown as File;
}

describe("parseBmsWorkbook — padrão canônico BMS Jogab", () => {
  it("importa COPI (2 abas BMS 01/02)", async () => {
    const wb = await parseBmsWorkbook(loadFile("bms-copi.xlsx"));
    expect(wb.sheets.map((s) => s.numero)).toEqual(["BMS 01", "BMS 02"]);
    expect(wb.ignoradas).toHaveLength(0);
    const bms1 = wb.sheets[0];
    expect(bms1.itens.length).toBeGreaterThan(5);
    expect(bms1.cliente_unidade).toContain("Cofco");
    expect(bms1.contratada).toContain("JOGAB");
    expect(bms1.contrato_numero).toBe("4509910004");
    expect(bms1.cond_pagamento).toBe("28 DDL");
    // total_medicao ≈ soma dos valor_mes
    const soma = bms1.itens.reduce((a, i) => a + i.valor_mes, 0);
    expect(Math.abs(bms1.total_medicao - soma)).toBeLessThan(1);
  });

  it("importa BARRA (ADIANTAMENTO + BMS 01-03) e ordena ADIANTAMENTO primeiro", async () => {
    const wb = await parseBmsWorkbook(loadFile("bms-barra.xlsx"));
    const nums = wb.sheets.map((s) => s.numero);
    expect(nums[0]).toBe("ADIANTAMENTO");
    expect(nums).toContain("BMS 01");
    expect(nums).toContain("BMS 03");
    expect(wb.sheets[0].ordem).toBe(0);
    expect(wb.sheets.find((s) => s.numero === "BMS 03")?.ordem).toBe(3);
    expect(wb.sheets[0].contrato_numero).toBe("4509922973");
  });

  it("importa HUMUS (múltiplas BMS)", async () => {
    const wb = await parseBmsWorkbook(loadFile("bms-humus.xlsx"));
    expect(wb.sheets.length).toBeGreaterThanOrEqual(1);
    for (const s of wb.sheets) {
      expect(s.itens.length).toBeGreaterThan(0);
      for (const it of s.itens) {
        expect(it.percentual_atual).toBeGreaterThanOrEqual(0);
        expect(it.percentual_atual).toBeLessThanOrEqual(100.001);
      }
    }
  });
});
