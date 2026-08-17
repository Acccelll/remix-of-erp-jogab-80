import { describe, it, expect } from "vitest";
import { derivarVencimento } from "../vencimento";

describe("derivarVencimento", () => {
  it("prazo simples (30 DDL)", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-05-03",
      obra: { prazo_pagamento_dias: 30 },
    });
    expect(r.fonte).toBe("obra");
    expect(r.data).toBe("2026-06-02");
    expect(r.prazoDias).toBe(30);
  });

  it("prazo com dias fixos (05,15,25) — 03/05 + 30 DDL cai em 02/06 → 05/06", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-05-03",
      obra: { prazo_pagamento_dias: 30, dias_fixos_pagamento: [5, 15, 25] },
    });
    expect(r.fonte).toBe("obra");
    expect(r.data).toBe("2026-06-05");
  });

  it("prazo 90 DDL", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-01-15",
      obra: { prazo_pagamento_dias: 90 },
    });
    expect(r.fonte).toBe("obra");
    expect(r.data).toBe("2026-04-15");
  });

  it("obra tem condição e cliente também → obra vence", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-05-03",
      obra: { prazo_pagamento_dias: 30 },
      cliente: { prazo_pagamento_dias: 60 },
    });
    expect(r.fonte).toBe("obra");
    expect(r.prazoDias).toBe(30);
  });

  it("cai no cliente quando obra não tem condição", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-05-03",
      obra: {},
      cliente: { prazo_pagamento_dias: 45 },
    });
    expect(r.fonte).toBe("cliente");
    expect(r.prazoDias).toBe(45);
  });

  it("dia_fixo_pagamento singular quando dias_fixos_pagamento vazio", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-05-03",
      obra: { prazo_pagamento_dias: 30, dias_fixos_pagamento: [], dia_fixo_pagamento: 20 },
    });
    expect(r.fonte).toBe("obra");
    expect(r.data).toBe("2026-06-20");
  });

  it("manual vence tudo", () => {
    const r = derivarVencimento({
      dataEmissao: "2026-05-03",
      dataVencimentoManual: "2026-07-01",
      obra: { prazo_pagamento_dias: 30 },
    });
    expect(r.fonte).toBe("manual");
    expect(r.data).toBe("2026-07-01");
  });

  it("nenhuma condição cadastrada → indisponivel", () => {
    const r = derivarVencimento({ dataEmissao: "2026-05-03" });
    expect(r.fonte).toBe("indisponivel");
    expect(r.data).toBeNull();
  });

  it("dataEmissao nula → indisponivel (sem lançar)", () => {
    const r = derivarVencimento({
      dataEmissao: null,
      obra: { prazo_pagamento_dias: 30 },
    });
    expect(r.fonte).toBe("indisponivel");
  });

  it("entrada inválida não lança exceção", () => {
    const r = derivarVencimento({ dataEmissao: "banana" as any });
    expect(r.fonte).toBe("indisponivel");
  });
});
