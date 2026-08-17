import { describe, it, expect } from "vitest";
import { montarLinhasBalanco, detectarSobreposicoes } from "@/lib/cronograma/linha-balanco";

const mk = (id: string, servico: string | null, loc: number | null, ini: string, fim: string) => ({
  id,
  servico_lob: servico,
  loc_ordem: loc,
  data_inicio: ini,
  data_fim: fim,
});

describe("montarLinhasBalanco", () => {
  it("agrupa por serviço e ordena por localização", () => {
    const linhas = montarLinhasBalanco([
      mk("a", "Alvenaria", 2, "2025-02-01", "2025-02-28"),
      mk("b", "Alvenaria", 1, "2025-01-01", "2025-01-31"),
      mk("c", "Elétrica", 1, "2025-03-01", "2025-03-15"),
    ]);
    expect(linhas).toHaveLength(2);
    const alv = linhas.find((l) => l.servico === "Alvenaria")!;
    expect(alv.pontos.map((p) => p.loc)).toEqual([1, 2]);
    expect(alv.pontos.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("ignora atividades sem servico_lob ou sem loc_ordem", () => {
    const linhas = montarLinhasBalanco([
      mk("a", null, 1, "2025-01-01", "2025-01-31"),
      mk("b", "Alvenaria", null, "2025-01-01", "2025-01-31"),
      mk("c", "Alvenaria", 1, "2025-01-01", "2025-01-31"),
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].pontos).toHaveLength(1);
    expect(linhas[0].pontos[0].id).toEqual("c");
  });

  it("ignora datas inválidas", () => {
    const linhas = montarLinhasBalanco([
      mk("a", "X", 1, "data-quebrada", "2025-01-31"),
      mk("b", "X", 2, "2025-02-01", "2025-02-28"),
    ]);
    expect(linhas[0].pontos.map((p) => p.id)).toEqual(["b"]);
  });

  it("ritmo crescente sem sobreposição não gera conflito", () => {
    const linhas = montarLinhasBalanco([
      mk("a", "Alv", 1, "2025-01-01", "2025-01-31"),
      mk("b", "Alv", 2, "2025-02-01", "2025-02-28"),
      mk("c", "Alv", 3, "2025-03-01", "2025-03-31"),
    ]);
    expect(detectarSobreposicoes(linhas)).toEqual([]);
  });

  it("detecta sobreposição entre localizações consecutivas", () => {
    const linhas = montarLinhasBalanco([
      mk("a", "Alv", 1, "2025-01-01", "2025-02-15"),
      mk("b", "Alv", 2, "2025-02-01", "2025-02-28"),
    ]);
    const conflitos = detectarSobreposicoes(linhas);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]).toMatchObject({ servico: "Alv", aId: "a", bId: "b" });
  });

  it("mesma localização com 2 atividades — vira 2 pontos distintos", () => {
    const linhas = montarLinhasBalanco([
      mk("a", "Alv", 1, "2025-01-01", "2025-01-15"),
      mk("b", "Alv", 1, "2025-01-16", "2025-01-31"),
    ]);
    expect(linhas[0].pontos).toHaveLength(2);
    expect(linhas[0].pontos.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("serviços ordenados alfabeticamente", () => {
    const linhas = montarLinhasBalanco([
      mk("a", "Zelo", 1, "2025-01-01", "2025-01-31"),
      mk("b", "Alvenaria", 1, "2025-01-01", "2025-01-31"),
      mk("c", "Mestre", 1, "2025-01-01", "2025-01-31"),
    ]);
    expect(linhas.map((l) => l.servico)).toEqual(["Alvenaria", "Mestre", "Zelo"]);
  });
});
