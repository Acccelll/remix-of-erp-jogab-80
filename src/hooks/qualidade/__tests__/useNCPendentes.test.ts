import { describe, it, expect } from "vitest";
import { coalescePrazoDate, computeSituacao } from "@/hooks/qualidade/useNCPendentes";

describe("useNCPendentes helpers — PRO-007.slice-06", () => {
  it("coalescePrazoDate prefere `prazo` (ISO timestamptz) sobre `quando_planejado`", () => {
    expect(coalescePrazoDate("2026-08-15T18:00:00Z", "2026-07-01")).toBe("2026-08-15");
  });

  it("coalescePrazoDate cai para `quando_planejado` quando `prazo` é null", () => {
    expect(coalescePrazoDate(null, "2026-07-01")).toBe("2026-07-01");
  });

  it("coalescePrazoDate retorna null se ambos ausentes", () => {
    expect(coalescePrazoDate(null, null)).toBeNull();
  });

  it("computeSituacao prioriza aguardando_reinspecao sobre prazo", () => {
    expect(computeSituacao(-10, true)).toBe("aguardando_reinspecao");
    expect(computeSituacao(30, true)).toBe("aguardando_reinspecao");
  });

  it("computeSituacao mapeia dias corretamente quando não aguardando", () => {
    expect(computeSituacao(-1, false)).toBe("vencida");
    expect(computeSituacao(0, false)).toBe("hoje");
    expect(computeSituacao(5, false)).toBe("proxima");
  });
});
