import { describe, expect, it } from "vitest";
import { resumoMensalFechados, type RdoFechadoRow } from "../resumo-mensal";

const base = (over: Partial<RdoFechadoRow>): RdoFechadoRow => ({
  id: crypto.randomUUID(),
  obra_id: "obra-a",
  data: "2026-07-01",
  status: "fechado",
  fechado_em: "2026-07-01T18:00:00Z",
  assinado_por: "Ana",
  numero_documental: "RDO-2026-0001",
  ...over,
});

describe("resumoMensalFechados", () => {
  it("ignora RDOs não fechados", () => {
    const linhas = resumoMensalFechados([
      base({ status: "rascunho" }),
      base({ status: "sincronizado" }),
    ]);
    expect(linhas).toHaveLength(0);
  });

  it("agrupa por mês/obra/assinante e conta totais", () => {
    const linhas = resumoMensalFechados([
      base({ data: "2026-07-01", assinado_por: "Ana", numero_documental: "RDO-2026-0001" }),
      base({ data: "2026-07-15", assinado_por: "Ana", numero_documental: "RDO-2026-0005" }),
      base({ data: "2026-07-20", assinado_por: "Bruno", numero_documental: "RDO-2026-0007" }),
      base({ data: "2026-08-02", assinado_por: "Ana", numero_documental: "RDO-2026-0010" }),
    ]);
    expect(linhas).toHaveLength(3);
    const anaJul = linhas.find((l) => l.mes === "2026-07" && l.assinado_por === "Ana")!;
    expect(anaJul.total).toBe(2);
    expect(anaJul.primeiro_numero).toBe("RDO-2026-0001");
    expect(anaJul.ultimo_numero).toBe("RDO-2026-0005");
  });

  it("normaliza assinante vazio para '—'", () => {
    const linhas = resumoMensalFechados([
      base({ assinado_por: null }),
      base({ assinado_por: "   " }),
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].assinado_por).toBe("—");
    expect(linhas[0].total).toBe(2);
  });

  it("ordena por mês desc", () => {
    const linhas = resumoMensalFechados([
      base({ data: "2026-05-01" }),
      base({ data: "2026-08-01" }),
      base({ data: "2026-06-01" }),
    ]);
    expect(linhas.map((l) => l.mes)).toEqual(["2026-08", "2026-06", "2026-05"]);
  });
});
