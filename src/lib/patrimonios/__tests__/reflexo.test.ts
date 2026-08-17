import { describe, expect, it } from "vitest";
import {
  etiquetasDaColuna,
  obraRefletidaDoPatrimonio,
  type ColaboradorRef,
  type PatrimonioRef,
} from "@/lib/patrimonios/reflexo";

const colabs: ColaboradorRef[] = [
  { id: "c1", obraAtualId: "obra-a", statusEspecial: null },
  { id: "c2", obraAtualId: null, statusEspecial: "ferias" },
  { id: "c3", obraAtualId: null, statusEspecial: null },
];

const pat = (over: Partial<PatrimonioRef> = {}): PatrimonioRef => ({
  id: "p1",
  obraAtualId: null,
  responsavelId: null,
  ...over,
});

describe("obraRefletidaDoPatrimonio", () => {
  it("reflete na obra onde o responsável está", () => {
    expect(obraRefletidaDoPatrimonio(pat({ responsavelId: "c1" }), colabs)).toBe("obra-a");
  });

  it("não reflete quando o responsável está de férias", () => {
    // Bem entregue a quem está fora não pode aparecer em obra nenhuma: ele
    // não está lá.
    expect(obraRefletidaDoPatrimonio(pat({ responsavelId: "c2" }), colabs)).toBeNull();
  });

  it("não reflete quando o responsável não tem obra", () => {
    expect(obraRefletidaDoPatrimonio(pat({ responsavelId: "c3" }), colabs)).toBeNull();
  });

  it("não reflete sem responsável, nem com responsável inexistente", () => {
    expect(obraRefletidaDoPatrimonio(pat(), colabs)).toBeNull();
    expect(obraRefletidaDoPatrimonio(pat({ responsavelId: "sumiu" }), colabs)).toBeNull();
  });
});

describe("etiquetasDaColuna", () => {
  const proprio = pat({ id: "proprio", obraAtualId: "obra-a" });
  const comResp = pat({ id: "com-resp", obraAtualId: null, responsavelId: "c1" });
  const todos = [proprio, comResp];

  it("junta as próprias com as refletidas na coluna da obra", () => {
    const r = etiquetasDaColuna("obra-a", todos, colabs);
    expect(r.map((e) => [e.item.id, e.origem])).toEqual([
      ["proprio", "propria"],
      ["com-resp", "reflexo"],
    ]);
    expect(r[1].responsavelId).toBe("c1");
  });

  it("não duplica o bem: ele continua na coluna do responsável como próprio", () => {
    // A posição real do bem é a coluna do responsável — a etiqueta na obra é
    // reflexo. O quadro monta a coluna `__resp__c1` pelo obraAtualId local.
    const naColunaDoResp = pat({ id: "com-resp", obraAtualId: "__resp__c1", responsavelId: "c1" });
    const r = etiquetasDaColuna("__resp__c1", [naColunaDoResp], colabs);
    expect(r).toHaveLength(1);
    expect(r[0].origem).toBe("propria");
  });

  it("colunas especiais e de responsável não recebem reflexo", () => {
    expect(etiquetasDaColuna("__manutencao__", todos, colabs)).toHaveLength(0);
    expect(etiquetasDaColuna("__resp__c1", todos, colabs)).toHaveLength(0);
  });

  it("Sem Alocação não recebe reflexo", () => {
    const semNada = pat({ id: "solto", obraAtualId: null });
    const r = etiquetasDaColuna(null, [semNada], colabs);
    expect(r.map((e) => e.origem)).toEqual(["propria"]);
  });
});
