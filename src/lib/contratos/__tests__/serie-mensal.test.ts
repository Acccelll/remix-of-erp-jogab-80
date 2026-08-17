import { describe, expect, it } from "vitest";
import { serieContratosMensal, contratosDoMes } from "../serie-mensal";

import type { Contrato } from "@/types";

function c(over: Partial<Contrato>): Contrato {
  return {
    id: over.id ?? crypto.randomUUID(),
    locacaoServico: "X",
    inicio: over.inicio ?? "",
    termino: over.termino ?? "",
    responsavel: "",
    contato: "",
    valor: 0,
    tipo: "servico" as any,
    status: (over.status ?? "vigente") as any,
    ativo: over.ativo ?? true,
    obraAtualId: null,
    mobilizacaoPendente: null,
    historico: [],
    aditivos: over.aditivos ?? [],
    ...over,
  } as Contrato;
}

describe("serieContratosMensal", () => {
  const hoje = new Date(2026, 5, 15); // jun/26

  it("gera N buckets consecutivos terminando no mês atual", () => {
    const s = serieContratosMensal([], 3, hoje);
    expect(s.map((b) => b.chave)).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("conta novos e encerrados no mês correto", () => {
    const contratos: Contrato[] = [
      c({ inicio: "2026-05-10" }), // novo em maio
      c({ inicio: "2026-06-01" }), // novo em jun
      c({ inicio: "2026-01-01", status: "encerrado", termino: "2026-04-20" }),
      c({
        inicio: "2026-01-01",
        status: "encerrado",
        termino: "2026-03-01",
        aditivos: [{ tipo: "prorrogacao", data: "", novoTermino: "2026-06-05" } as any],
      }),
    ];
    const s = serieContratosMensal(contratos, 3, hoje);
    expect(s.find((b) => b.chave === "2026-05")!.novos).toBe(1);
    expect(s.find((b) => b.chave === "2026-06")!.novos).toBe(1);
    expect(s.find((b) => b.chave === "2026-04")!.encerrados).toBe(1);
    expect(s.find((b) => b.chave === "2026-06")!.encerrados).toBe(1);
  });
});

describe("contratosDoMes", () => {
  it("retorna novos e encerrados do bucket informado", () => {
    const contratos: Contrato[] = [
      c({ id: "a", inicio: "2026-05-10" }),
      c({ id: "b", inicio: "2026-06-01" }),
      c({ id: "c", inicio: "2026-01-01", status: "encerrado", termino: "2026-05-20" }),
    ];
    const mai = contratosDoMes(contratos, "2026-05");
    expect(mai.novos.map((x) => x.id)).toEqual(["a"]);
    expect(mai.encerrados.map((x) => x.id)).toEqual(["c"]);
    const jun = contratosDoMes(contratos, "2026-06");
    expect(jun.novos.map((x) => x.id)).toEqual(["b"]);
    expect(jun.encerrados).toEqual([]);
  });
});

