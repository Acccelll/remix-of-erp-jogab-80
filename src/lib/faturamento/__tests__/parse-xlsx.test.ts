import { describe, expect, it, vi } from "vitest";
import { parseFaturamentoXlsx } from "../parse-xlsx";

vi.mock("xlsx", () => ({
  read: () => ({
    SheetNames: ["Detalhe Nfse"],
    Sheets: { "Detalhe Nfse": {} },
  }),
  utils: {
    sheet_to_json: () => [
      {
        "Numero NFS-e": "532",
        "ISS Retido": 90.45,
        "ISS a reter (Sim,Não)": "Sim",
        "Valor dos Serviços": 1000,
        "Valor Líquido": 909.55,
      },
    ],
  },
}));

describe("parseFaturamentoXlsx", () => {
  it("lê o indicador textual de retenção, não o valor numérico do ISS", async () => {
    const file = {
      name: "faturamento.xlsx",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as File;

    const { linhas } = await parseFaturamentoXlsx(file);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].iss_retido).toBe(true);
  });
});