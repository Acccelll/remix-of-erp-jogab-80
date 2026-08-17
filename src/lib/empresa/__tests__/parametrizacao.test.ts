import { beforeEach, describe, expect, it } from "vitest";
import {
  avancarSequencia,
  DEFAULT_NUMERACAO,
  empresaParametrizacaoRepo,
  formatarNumero,
  paramVazia,
  resolverConfig,
} from "../parametrizacao";

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
});

describe("formatarNumero", () => {
  it("aplica prefixo e padding", () => {
    expect(formatarNumero({ prefixo: "RDO", padding: 6, proximo: 1 }, 42)).toBe(
      "RDO-000042",
    );
  });
  it("respeita padding mínimo", () => {
    expect(formatarNumero({ prefixo: "", padding: 3, proximo: 1 }, 7)).toBe("007");
  });
});

describe("avancarSequencia", () => {
  it("emite o número atual e incrementa 'proximo'", () => {
    const cfg = { prefixo: "MED", padding: 4, proximo: 10 };
    const r = avancarSequencia(cfg);
    expect(r.numero).toBe("MED-0010");
    expect(r.emitido).toBe(10);
    expect(r.config.proximo).toBe(11);
    // Puro — cfg original não é mutado.
    expect(cfg.proximo).toBe(10);
  });
});

describe("resolverConfig", () => {
  it("cai para default quando o tipo não foi customizado", () => {
    const p = paramVazia("emp-1");
    expect(resolverConfig(p, "rdo")).toEqual(DEFAULT_NUMERACAO.rdo);
  });
});

describe("empresaParametrizacaoRepo (persistência)", () => {
  it("save + get preservam configurações e isolam por empresa", () => {
    empresaParametrizacaoRepo.setLogo("emp-1", "https://x/logo.png");
    empresaParametrizacaoRepo.setNumeracao("emp-1", "rdo", {
      prefixo: "OBRA-A",
      padding: 5,
      proximo: 100,
    });
    const a = empresaParametrizacaoRepo.get("emp-1");
    const b = empresaParametrizacaoRepo.get("emp-2");
    expect(a.logoUrl).toBe("https://x/logo.png");
    expect(a.numeracoes.rdo?.proximo).toBe(100);
    expect(b.logoUrl).toBeNull();
    expect(b.numeracoes.rdo).toBeUndefined();
  });

  it("emitirNumero avança a sequência entre chamadas", () => {
    empresaParametrizacaoRepo.setNumeracao("emp-1", "medicao", {
      prefixo: "M",
      padding: 3,
      proximo: 1,
    });
    const a = empresaParametrizacaoRepo.emitirNumero("emp-1", "medicao");
    const b = empresaParametrizacaoRepo.emitirNumero("emp-1", "medicao");
    expect(a.numero).toBe("M-001");
    expect(b.numero).toBe("M-002");
    expect(empresaParametrizacaoRepo.get("emp-1").numeracoes.medicao?.proximo).toBe(3);
  });

  it("emitirNumero para tipo sem custom usa default e persiste", () => {
    const r = empresaParametrizacaoRepo.emitirNumero("emp-1", "cotacao");
    expect(r.numero).toBe("COT-000001");
    const cfg = empresaParametrizacaoRepo.get("emp-1").numeracoes.cotacao;
    expect(cfg?.proximo).toBe(2);
    expect(cfg?.prefixo).toBe("COT");
  });
});
