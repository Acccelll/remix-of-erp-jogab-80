import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/repositories/notificacoes", () => ({
  notificacoesRepo: {
    insert: vi.fn().mockResolvedValue(undefined),
  },
}));

import { criarNotificacao, _resetNotificacaoDedupe } from "../index";
import { notificacoesRepo } from "@/lib/repositories/notificacoes";

const insertMock = notificacoesRepo.insert as unknown as ReturnType<typeof vi.fn>;

describe("criarNotificacao — dedupe (PRO-030)", () => {
  beforeEach(() => {
    _resetNotificacaoDedupe();
    insertMock.mockClear();
  });

  it("insere quando não há dedupeKey", async () => {
    const r = await criarNotificacao({
      tipo: "x",
      role_scope: "compras",
      titulo: "t",
    });
    expect(r.inserted).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("insere primeira vez e ignora repetição com mesma dedupeKey", async () => {
    const a = await criarNotificacao({
      tipo: "x",
      role_scope: "compras",
      titulo: "t",
      dedupeKey: "k:1",
    });
    const b = await criarNotificacao({
      tipo: "x",
      role_scope: "compras",
      titulo: "t",
      dedupeKey: "k:1",
    });
    expect(a.inserted).toBe(true);
    expect(b.inserted).toBe(false);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("chaves diferentes inserem cada uma", async () => {
    await criarNotificacao({ tipo: "x", role_scope: "compras", titulo: "t", dedupeKey: "a" });
    await criarNotificacao({ tipo: "x", role_scope: "compras", titulo: "t", dedupeKey: "b" });
    expect(insertMock).toHaveBeenCalledTimes(2);
  });
});
