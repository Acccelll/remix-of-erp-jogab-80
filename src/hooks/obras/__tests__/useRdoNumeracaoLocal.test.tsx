import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { empresaParametrizacaoRepo } from "@/lib/empresa/parametrizacao";
import { useRdoNumeracaoLocal } from "../useRdoNumeracaoLocal";

beforeEach(() => {
  localStorage.clear();
});

describe("useRdoNumeracaoLocal · PRO-031", () => {
  it("usa a numeração parametrizada da empresa quando RDO está customizado", () => {
    empresaParametrizacaoRepo.setNumeracao("emp-1", "rdo", {
      prefixo: "RDO-E1",
      padding: 3,
      proximo: 10,
    });
    const { result } = renderHook(() => useRdoNumeracaoLocal());

    let registro: ReturnType<typeof result.current.registrar> | undefined;
    act(() => {
      registro = result.current.registrar({
        id: "rdo-1",
        obraId: "obra-1",
        empresaId: "emp-1",
        data: "2026-05-10",
      });
    });

    expect(registro).toMatchObject({
      empresaId: "emp-1",
      ano: 2026,
      sequencial: 10,
      numero: "RDO-E1-010",
    });
    expect(empresaParametrizacaoRepo.get("emp-1").numeracoes.rdo?.proximo).toBe(11);
  });

  it("mantém fallback legado quando a empresa não customizou RDO", () => {
    const { result } = renderHook(() => useRdoNumeracaoLocal());

    let registro: ReturnType<typeof result.current.registrar> | undefined;
    act(() => {
      registro = result.current.registrar({
        id: "rdo-1",
        obraId: "obra-1",
        empresaId: "emp-sem-rdo",
        data: "2026-05-10",
      });
    });

    expect(registro).toMatchObject({
      empresaId: "emp-sem-rdo",
      ano: 2026,
      sequencial: 1,
      numero: "RDO-2026-0001",
    });
    expect(empresaParametrizacaoRepo.get("emp-sem-rdo").numeracoes.rdo).toBeUndefined();
  });
});