import { describe, it, expect } from "vitest";
import { calcularCurvaResultado } from "../curva-resultado";

const hoje = new Date(2025, 5, 15); // 2025-06-15

describe("calcularCurvaResultado", () => {
  it("curva banana: despesas antes do faturamento → negativo no início", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [{ data_emissao: "2025-05-10", valor: 100, status: "emitida" }],
      bms: [],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "1",
          valor_rateio: 80,
          data_pagamento: "2025-03-10",
          data_vencimento: "2025-03-10",
        },
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "1",
          valor_rateio: 50,
          data_pagamento: "2025-04-10",
          data_vencimento: "2025-04-10",
        },
      ],
    });
    const mar = pontos.find((p) => p.mes === "2025-03")!;
    const abr = pontos.find((p) => p.mes === "2025-04")!;
    const mai = pontos.find((p) => p.mes === "2025-05")!;
    expect(mar.resultadoReal).toBe(-80);
    expect(abr.resultadoReal).toBe(-130);
    expect(mai.resultadoReal).toBe(-30);
  });

  it("ancoragem: projetado em hoje === real em hoje", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [{ data_emissao: "2025-06-01", valor: 200 }],
      bms: [
        { status: "aberta", data_emissao_nfs_prevista: "2025-07-15", valor_previsto_dinamico: 100 },
      ],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "1",
          valor_rateio: 50,
          data_pagamento: "2025-06-01",
          data_vencimento: "2025-06-01",
        },
      ],
    });
    const jun = pontos.find((p) => p.mes === "2025-06")!;
    expect(jun.resultadoReal).toBe(150);
    expect(jun.resultadoProjetado).toBe(150);
  });

  it("exclusões: grupo '3' e status_cod 18 são ignorados", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [{ data_emissao: "2025-06-01", valor: 100 }],
      bms: [],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "3",
          valor_rateio: 999,
          data_pagamento: "2025-06-01",
          data_vencimento: "2025-06-01",
        },
        {
          natureza_tipo: 2,
          status_cod: 18,
          grupo: "1",
          valor_rateio: 999,
          data_pagamento: "2025-06-01",
          data_vencimento: "2025-06-01",
        },
      ],
    });
    expect(pontos.find((p) => p.mes === "2025-06")!.resultadoReal).toBe(100);
  });

  it("despesa vencida não paga (status 40) conta em despReal", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [],
      bms: [],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 40,
          grupo: "1",
          valor_rateio: 75,
          data_pagamento: null,
          data_vencimento: "2025-04-20",
        },
      ],
    });
    expect(pontos.find((p) => p.mes === "2025-04")!.despReal).toBe(75);
  });

  it("baixada usa data_pagamento; aberta usa data_vencimento", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [],
      bms: [],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "1",
          valor_rateio: 10,
          data_pagamento: "2025-05-05",
          data_vencimento: "2025-04-20",
        },
        {
          natureza_tipo: 2,
          status_cod: 56,
          grupo: "1",
          valor_rateio: 20,
          data_pagamento: null,
          data_vencimento: "2025-08-10",
        },
      ],
    });
    expect(pontos.find((p) => p.mes === "2025-05")!.despReal).toBe(10);
    expect(pontos.find((p) => p.mes === "2025-08")!.despAVencer).toBe(20);
  });

  it("BMS fechadas não entram em fatPrevisto; aberta atrasada cai no mês corrente", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [],
      bms: [
        {
          status: "fechada",
          data_emissao_nfs_prevista: "2025-07-15",
          valor_previsto_dinamico: 999,
        },
        {
          status: "faturada",
          data_emissao_nfs_prevista: "2025-07-15",
          valor_previsto_dinamico: 999,
        },
        { status: "aberta", data_emissao_nfs_prevista: "2025-03-10", valor_previsto_dinamico: 100 },
        { status: "aberta", data_emissao_nfs_prevista: "2025-08-10", valor_previsto_dinamico: 50 },
      ],
      fin: [],
    });
    expect(pontos.find((p) => p.mes === "2025-06")!.fatPrevisto).toBe(100);
    expect(pontos.find((p) => p.mes === "2025-08")!.fatPrevisto).toBe(50);
  });

  it("meses sem eventos mantêm acumulado constante", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [{ data_emissao: "2025-03-01", valor: 100 }],
      bms: [],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "1",
          valor_rateio: 30,
          data_pagamento: "2025-06-10",
          data_vencimento: "2025-06-10",
        },
      ],
    });
    const abr = pontos.find((p) => p.mes === "2025-04")!;
    const mai = pontos.find((p) => p.mes === "2025-05")!;
    expect(abr.resultadoReal).toBe(100);
    expect(mai.resultadoReal).toBe(100);
    expect(pontos.map((p) => p.mes)).toEqual(["2025-03", "2025-04", "2025-05", "2025-06"]);
  });

  it("usa valor_rateio (não valor cheio do título)", () => {
    const pontos = calcularCurvaResultado({
      hoje,
      nfs: [],
      bms: [],
      fin: [
        {
          natureza_tipo: 2,
          status_cod: 3,
          grupo: "1",
          valor_rateio: 40,
          data_pagamento: "2025-06-01",
          data_vencimento: "2025-06-01",
        },
      ],
    });
    expect(pontos.find((p) => p.mes === "2025-06")!.despReal).toBe(40);
  });
});
