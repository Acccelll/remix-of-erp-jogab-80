import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mobilizarPatrimonio = vi.fn();
const mobilizarVeiculo = vi.fn();

vi.mock("@/contexts/PatrimoniosContext", () => ({
  usePatrimoniosContext: () => ({ mobilizarPatrimonio }),
}));
vi.mock("@/contexts/VeiculosContext", () => ({
  useVeiculosContext: () => ({ mobilizarVeiculo }),
}));

const confirmarEstoque = vi.fn();
const getById = vi.fn();
const marcarItemPatrimonioMobilizado = vi.fn();
const marcarVeiculoMobilizado = vi.fn();
const setStatusFinal = vi.fn();

vi.mock("@/lib/repositories/romaneios", () => ({
  romaneiosRepo: {
    confirmarEstoque: (...args: unknown[]) => confirmarEstoque(...args),
    getById: (...args: unknown[]) => getById(...args),
    marcarItemPatrimonioMobilizado: (...args: unknown[]) => marcarItemPatrimonioMobilizado(...args),
    marcarVeiculoMobilizado: (...args: unknown[]) => marcarVeiculoMobilizado(...args),
    setStatusFinal: (...args: unknown[]) => setStatusFinal(...args),
  },
}));

import { useConfirmarRomaneio } from "../useConfirmarRomaneio";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

function romaneioBase(overrides: Partial<any> = {}) {
  return {
    romaneio: {
      id: "rom-1",
      data_programada: "2026-08-10",
      obra_destino_id: "obra-2",
      mobilizar_veiculo: false,
      veiculo_transportador_id: null,
      ...overrides,
    },
    itensEstoque: [],
    itensPatrimonio: [],
  };
}

describe("useConfirmarRomaneio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmarEstoque.mockResolvedValue({ ok: true });
    mobilizarPatrimonio.mockResolvedValue(undefined);
    mobilizarVeiculo.mockResolvedValue(undefined);
  });

  it("sem itens de patrimônio/veículo: confirma direto após leg de estoque", async () => {
    getById.mockResolvedValue(romaneioBase());
    const { result } = renderHook(() => useConfirmarRomaneio(), { wrapper });

    await act(async () => {
      await result.current.confirmar("rom-1");
    });

    expect(confirmarEstoque).toHaveBeenCalledWith("rom-1");
    expect(setStatusFinal).toHaveBeenCalledWith("rom-1", "confirmado");
    expect(result.current.failures).toEqual([]);
    expect(result.current.error).toBe("");
  });

  it("falha na leg de estoque: não toca patrimônio/veículo e reporta erro", async () => {
    confirmarEstoque.mockRejectedValue(new Error("Saldo insuficiente"));
    const { result } = renderHook(() => useConfirmarRomaneio(), { wrapper });

    await act(async () => {
      await result.current.confirmar("rom-1");
    });

    expect(getById).not.toHaveBeenCalled();
    expect(mobilizarPatrimonio).not.toHaveBeenCalled();
    expect(setStatusFinal).not.toHaveBeenCalled();
    expect(result.current.error).toContain("Saldo insuficiente");
  });

  it("todas as legs de patrimônio/veículo sucedem: status confirmado", async () => {
    getById.mockResolvedValueOnce({
      ...romaneioBase({ mobilizar_veiculo: true, veiculo_transportador_id: "v-1" }),
      itensPatrimonio: [
        { id: "item-1", patrimonio_id: "pat-1", patrimonio_nome: "Gerador", mobilizado: false },
      ],
    });
    const { result } = renderHook(() => useConfirmarRomaneio(), { wrapper });

    await act(async () => {
      await result.current.confirmar("rom-1");
    });

    expect(mobilizarPatrimonio).toHaveBeenCalledWith("pat-1", "obra-2", 10, 8, 2026);
    expect(mobilizarVeiculo).toHaveBeenCalledWith("v-1", "obra-2", 10, 8, 2026);
    expect(marcarItemPatrimonioMobilizado).toHaveBeenCalledWith("item-1", true);
    expect(marcarVeiculoMobilizado).toHaveBeenCalledWith("rom-1", true);
    expect(setStatusFinal).toHaveBeenCalledWith("rom-1", "confirmado");
    expect(result.current.failures).toEqual([]);
  });

  it("uma mobilização de patrimônio lança exceção: status confirmado_parcial com failures", async () => {
    getById.mockResolvedValueOnce({
      ...romaneioBase(),
      itensPatrimonio: [
        { id: "item-1", patrimonio_id: "pat-1", patrimonio_nome: "Gerador", mobilizado: false },
        { id: "item-2", patrimonio_id: "pat-2", patrimonio_nome: "Betoneira", mobilizado: false },
      ],
    });
    mobilizarPatrimonio.mockImplementation((patId: string) => {
      if (patId === "pat-2") return Promise.reject(new Error("timeout"));
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useConfirmarRomaneio(), { wrapper });

    await act(async () => {
      await result.current.confirmar("rom-1");
    });

    expect(marcarItemPatrimonioMobilizado).toHaveBeenCalledWith("item-1", true);
    expect(marcarItemPatrimonioMobilizado).toHaveBeenCalledWith("item-2", false, "timeout");
    expect(setStatusFinal).toHaveBeenCalledWith("rom-1", "confirmado_parcial");
    expect(result.current.failures).toEqual([{ nome: "Betoneira", motivo: "timeout" }]);
  });
});
