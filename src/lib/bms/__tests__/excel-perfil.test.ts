import { describe, expect, it } from "vitest";
import { CHAVES_COL_MAP, type BmsLayoutPerfil } from "../layoutPerfis";
import { parseBmsWorkbook } from "../excel";

const colunas = Object.fromEntries(CHAVES_COL_MAP.map((k, i) => [k, i])) as BmsLayoutPerfil["colunas"];

async function arquivoBmsLivre(): Promise<File> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["Cliente ACME"],
    ["Cód.", "Serviço", "Qtd", "Un", "PU", "Total", "QA", "VA", "QM", "VM", "QAC", "VAC", "SQ", "SV"],
    ["sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub", "sub"],
    ["1", "Serviço medido", 1, "un", 10, 10, 0, 0, 1, 10, 1, 10, 0, 0],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Aba Livre");
  const data = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return {
    name: "livre.xlsx",
    arrayBuffer: async () => data,
  } as File;
}

describe("BMS parser com perfil de layout", () => {
  it("reprocessa aba ignorada usando perfil salvo", async () => {
    const file = await arquivoBmsLivre();
    const semPerfil = await parseBmsWorkbook(file);
    expect(semPerfil.sheets).toHaveLength(0);
    expect(semPerfil.ignoradas).toHaveLength(1);

    const perfil: BmsLayoutPerfil = {
      id: "perfil01",
      nome: "Layout livre",
      headerRow: 2,
      colunas,
      criadoEm: "2026-07-14T00:00:00.000Z",
      versao: 1,
      atualizadoEm: "2026-07-14T00:00:00.000Z",
    };

    const comPerfil = await parseBmsWorkbook(file, { perfisLayout: [perfil] });
    expect(comPerfil.ignoradas).toHaveLength(0);
    expect(comPerfil.sheets[0].perfil_layout_id).toBe("perfil01");
    expect(comPerfil.sheets[0].itens[0].descricao).toBe("Serviço medido");
    expect(comPerfil.sheets[0].total_medicao).toBe(10);
  });
});