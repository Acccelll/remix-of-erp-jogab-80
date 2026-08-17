import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let flagEnabled = false;

vi.mock("@/lib/repositories/featureFlags", () => ({
  featureFlagsRepo: {
    isEnabled: vi.fn(() => Promise.resolve(flagEnabled)),
  },
}));

import { useEstoqueProvider, TOTVS_RM_ESTOQUE_FLAG } from "../estoqueProviderFactory";
import { estoqueInternoProvider } from "../providers/estoqueInternoProvider";
import { totvsRmProvider } from "../providers/totvsRmProvider";
import { featureFlagsRepo } from "@/lib/repositories/featureFlags";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useEstoqueProvider", () => {
  beforeEach(() => {
    flagEnabled = false;
    vi.clearAllMocks();
  });

  it("resolve para o provider interno quando a flag está desligada (default hoje)", async () => {
    flagEnabled = false;
    const { result } = renderHook(() => useEstoqueProvider(), { wrapper });
    await waitFor(() => expect(featureFlagsRepo.isEnabled).toHaveBeenCalled());
    expect(result.current).toBe(estoqueInternoProvider);
  });

  it("resolve para o provider TOTVS RM quando a flag é ligada", async () => {
    flagEnabled = true;
    const { result } = renderHook(() => useEstoqueProvider(), { wrapper });
    await waitFor(() => expect(result.current).toBe(totvsRmProvider));
  });

  it("consulta a flag correta", async () => {
    renderHook(() => useEstoqueProvider(), { wrapper });
    await waitFor(() =>
      expect(featureFlagsRepo.isEnabled).toHaveBeenCalledWith(TOTVS_RM_ESTOQUE_FLAG, null),
    );
  });
});
