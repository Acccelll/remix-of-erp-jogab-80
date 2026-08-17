import { describe, it, expect } from "vitest";
import { quadrosDoCard, type QuadroRef, type CardRef } from "../quadrosDoCard";

const boards: QuadroRef[] = [
  { id: "b-compras", nome: "Setor: Compras", tipo: "setor", setor: "Compras" },
  { id: "b-producao", nome: "Setor: Producao", tipo: "setor", setor: "Producao" },
  { id: "b-obra-a", nome: "Obra A", tipo: "obra", obra_id: "obra-a" },
  { id: "b-obra-b", nome: "Obra B", tipo: "obra", obra_id: "obra-b" },
  { id: "b-custom-1", nome: "Lista Pessoal", tipo: "custom" },
  { id: "b-archived", nome: "Antigo", tipo: "setor", setor: "Compras", arquivado: true },
];

describe("quadrosDoCard", () => {
  it("retorna boards dos setores do card", () => {
    const card: CardRef = { id: "c1", obra_id: null, setores: ["Compras", "Producao"] };
    const r = quadrosDoCard(card, boards).map((b) => b.id);
    expect(r).toEqual(expect.arrayContaining(["b-compras", "b-producao"]));
    expect(r).not.toContain("b-archived");
  });

  it("inclui board da obra correspondente", () => {
    const card: CardRef = { id: "c1", obra_id: "obra-a", setores: ["Compras"] };
    const r = quadrosDoCard(card, boards).map((b) => b.id);
    expect(r).toContain("b-obra-a");
    expect(r).not.toContain("b-obra-b");
  });

  it("custom só entra quando explicitamente incluído", () => {
    const card: CardRef = { id: "c1", obra_id: null, setores: [] };
    expect(quadrosDoCard(card, boards).map((b) => b.id)).not.toContain("b-custom-1");
    expect(quadrosDoCard(card, boards, new Set(["b-custom-1"])).map((b) => b.id)).toContain(
      "b-custom-1",
    );
  });

  it("não duplica e ignora arquivados", () => {
    const card: CardRef = { id: "c1", obra_id: "obra-a", setores: ["Compras", "Producao"] };
    const r = quadrosDoCard(card, boards);
    expect(new Set(r.map((b) => b.id)).size).toBe(r.length);
    expect(r.some((b) => b.arquivado)).toBe(false);
  });

  it("entradas inválidas → array vazio", () => {
    expect(quadrosDoCard(null as any, boards)).toEqual([]);
    expect(quadrosDoCard({ id: "x" } as any, null as any)).toEqual([]);
  });
});
