/**
 * TST-002 (lote K) — Contratos de `rdoRepo` e `inspecoesRepo`.
 * Fixa colunas, filtros, ordenações e uso de `.single()` antes das
 * refatorações do módulo de campo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset, enfileirar } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { rdoRepo } from "@/lib/repositories/rdo";
import { inspecoesRepo, naoConformidadesRepo } from "@/lib/repositories/inspecoes";

const RDO_DETALHE_COLS =
  "id, obra_id, data, status, observacoes, origem, checklist_codigo, synced_at, clima_manha, clima_tarde, clima_noite, trabalhavel_manha, trabalhavel_tarde, trabalhavel_noite, owner_id, created_at, updated_at";

const INSPECAO_DETALHE_COLS =
  "id, obra_id, modelo_id, status, data_inspecao, data_planejada, local, responsavel_id, score, aprovado, assinatura_path, observacao, card_id, cronograma_item_id, geo_lat, geo_lng, created_by, created_at, updated_at";

describe("TST-002.k · rdoRepo", () => {
  beforeEach(() => reset());

  it("listPorObra() usa colunas padrão, filtra obra_id e ordena data desc", async () => {
    reset({ data: [{ id: "r1" }], error: null });
    const out = await rdoRepo.listPorObra("o1");

    expect(out).toEqual([{ id: "r1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("rdo");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(rec.ops[0].args[0]).toBe("id, data, status, clima, observacoes");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args).toEqual(["data", { ascending: false }]);
  });

  it("listPorObra() aceita override de colunas", async () => {
    await rdoRepo.listPorObra("o1", "id, data");
    expect(recorded[0].ops[0].args[0]).toBe("id, data");
  });

  it("listPorObra() devolve [] em data null e propaga erro", async () => {
    reset({ data: null, error: null });
    expect(await rdoRepo.listPorObra("o1")).toEqual([]);

    reset({ data: null, error: new Error("q") });
    await expect(rdoRepo.listPorObra("o1")).rejects.toThrow("q");
  });

  it("getById() usa colunas de detalhe + eq('id',...) + single()", async () => {
    reset({ data: { id: "r1" }, error: null });
    const out = await rdoRepo.getById("r1");

    expect(out).toEqual({ id: "r1" });
    const rec = recorded[0];
    expect(rec.table).toBe("rdo");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "single"]);
    expect(rec.ops[0].args[0]).toBe(RDO_DETALHE_COLS);
    expect(rec.ops[1].args).toEqual(["id", "r1"]);
    expect(rec.ops[2].args).toEqual([]);
  });

  it("getById() propaga erro", async () => {
    reset({ data: null, error: new Error("s") });
    await expect(rdoRepo.getById("r1")).rejects.toThrow("s");
  });

  it("create() faz insert simples e propaga erro", async () => {
    await rdoRepo.create({ obra_id: "o1", data: "2026-01-01" } as any);
    expect(recorded[0].table).toBe("rdo");
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [{ obra_id: "o1", data: "2026-01-01" }],
    });

    reset({ data: null, error: new Error("i") });
    await expect(rdoRepo.create({} as any)).rejects.toThrow("i");
  });

  it("update() aplica patch por id e propaga erro", async () => {
    await rdoRepo.update("r1", { status: "fechado" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ status: "fechado" }] },
      { op: "eq", args: ["id", "r1"] },
    ]);

    reset({ data: null, error: new Error("u") });
    await expect(rdoRepo.update("r1", {} as any)).rejects.toThrow("u");
  });
});

describe("TST-002.k · inspecoesRepo", () => {
  beforeEach(() => reset());

  it("list() usa colunas padrão e ordena data_inspecao desc", async () => {
    reset({ data: [{ id: "i1" }], error: null });
    const out = await inspecoesRepo.list();

    expect(out).toEqual([{ id: "i1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("inspecoes");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order"]);
    expect(rec.ops[0].args[0]).toBe(
      "id, obra_id, modelo_id, status, data_inspecao, responsavel_id",
    );
    expect(rec.ops[1].args).toEqual(["data_inspecao", { ascending: false }]);
  });

  it("list() aceita override de colunas", async () => {
    await inspecoesRepo.list("id, status");
    expect(recorded[0].ops[0].args[0]).toBe("id, status");
  });

  it("list() devolve [] em data null e propaga erro", async () => {
    reset({ data: null, error: null });
    expect(await inspecoesRepo.list()).toEqual([]);

    reset({ data: null, error: new Error("l") });
    await expect(inspecoesRepo.list()).rejects.toThrow("l");
  });

  it("getById() usa colunas de detalhe + eq('id',...) + single()", async () => {
    reset({ data: { id: "i1" }, error: null });
    const out = await inspecoesRepo.getById("i1");

    expect(out).toEqual({ id: "i1" });
    const rec = recorded[0];
    expect(rec.table).toBe("inspecoes");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "single"]);
    expect(rec.ops[0].args[0]).toBe(INSPECAO_DETALHE_COLS);
    expect(rec.ops[1].args).toEqual(["id", "i1"]);
  });

  it("create() insere em inspecoes e propaga erro", async () => {
    await inspecoesRepo.create({ obra_id: "o1" } as any);
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [{ obra_id: "o1" }],
    });

    reset({ data: null, error: new Error("i") });
    await expect(inspecoesRepo.create({} as any)).rejects.toThrow("i");
  });

  it("update() aplica patch por id e propaga erro", async () => {
    await inspecoesRepo.update("i1", { status: "ok" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ status: "ok" }] },
      { op: "eq", args: ["id", "i1"] },
    ]);

    reset({ data: null, error: new Error("u") });
    await expect(inspecoesRepo.update("i1", {} as any)).rejects.toThrow("u");
  });

  it("listNaoConformidades() usa tabela nao_conformidades, colunas padrão e ordena created_at desc", async () => {
    reset({ data: [{ id: "nc1" }], error: null });
    const out = await inspecoesRepo.listNaoConformidades();

    expect(out).toEqual([{ id: "nc1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("nao_conformidades");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order"]);
    expect(rec.ops[0].args[0]).toBe(
      "id, obra_id, inspecao_id, severidade, status, descricao",
    );
    expect(rec.ops[1].args).toEqual(["created_at", { ascending: false }]);
  });

  it("listNaoConformidades() aceita override e propaga erro", async () => {
    await inspecoesRepo.listNaoConformidades("id, severidade");
    expect(recorded[0].ops[0].args[0]).toBe("id, severidade");

    reset({ data: null, error: new Error("nc") });
    await expect(inspecoesRepo.listNaoConformidades()).rejects.toThrow("nc");
  });
});

describe("PRO-007.slice-04 · naoConformidadesRepo workflow", () => {
  beforeEach(() => reset());

  it("update() espelha campos legados para o contrato novo do workflow", async () => {
    await naoConformidadesRepo.update("nc1", {
      status: "aguardando_verificacao",
      quem: "u1",
      quando_planejado: "2026-07-20",
      como: "corrigir base",
    });

    expect(recorded[0].table).toBe("nao_conformidades");
    expect(recorded[0].ops).toEqual([
      {
        op: "update",
        args: [{
          status: "em_tratativa",
          quem: "u1",
          quando_planejado: "2026-07-20",
          como: "corrigir base",
          aguardando_reinspecao: true,
          responsavel_id: "u1",
          prazo: "2026-07-20T00:00:00.000Z",
          tratativa: "corrigir base",
        }],
      },
      { op: "eq", args: ["id", "nc1"] },
    ]);
  });

  it("getWorkflowState() reidrata estado a partir de colunas novas e legadas", async () => {
    reset({
      data: {
        id: "nc1",
        status: "em_tratativa",
        responsavel_id: null,
        prazo: null,
        tratativa: null,
        reinspecao_resultado: null,
        reinspecionada_em: null,
        encerrada_em: null,
        aguardando_reinspecao: true,
        quem: "u1",
        quando_planejado: "2026-07-20",
        como: "feito",
      },
      error: null,
    });

    const state = await naoConformidadesRepo.getWorkflowState("nc1");

    expect(state).toMatchObject({
      status: "aguardando_reinspecao",
      responsavelId: "u1",
      prazoISO: "2026-07-20T00:00:00.000Z",
      tratativa: "feito",
    });
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["select", "eq", "single"]);
  });

  it("applyTransition() persiste diff mínimo espelhado após transição válida", async () => {
    enfileirar(
      {
        data: {
          id: "nc1",
          status: "aberta",
          responsavel_id: null,
          prazo: null,
          tratativa: null,
          reinspecao_resultado: null,
          reinspecionada_em: null,
          encerrada_em: null,
          aguardando_reinspecao: false,
        },
        error: null,
      },
      { data: null, error: null },
    );

    const result = await naoConformidadesRepo.applyTransition("nc1", {
      type: "atribuir",
      responsavelId: "u1",
      prazoISO: "2026-07-20T12:00:00.000Z",
      nowISO: "2026-07-14T12:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(recorded[1].ops).toEqual([
      {
        op: "update",
        args: [{
          status: "em_tratativa",
          responsavel_id: "u1",
          prazo: "2026-07-20T12:00:00.000Z",
          quem: "u1",
          quando_planejado: "2026-07-20",
        }],
      },
      { op: "eq", args: ["id", "nc1"] },
    ]);
  });
});
