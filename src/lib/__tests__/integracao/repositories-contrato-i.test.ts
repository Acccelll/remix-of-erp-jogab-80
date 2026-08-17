/**
 * TST-002 (lote I) — Contratos de boards (`boardListasRepo`,
 * `boardCamposRepo`, `boardMembrosRepo`) e cronograma (`cronogramaRepo`,
 * `cronogramaItemRevisoesRepo`, `cronogramaCenariosRepo`,
 * `cronogramaCenarioItensRepo`). Fixa colunas, filtros e ordenações antes
 * das refatorações do Kanban e do planner (Onda 6).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset, enfileirar } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import {
  boardListasRepo,
  boardCamposRepo,
  boardMembrosRepo,
} from "@/lib/repositories/boards";
import {
  cronogramaRepo,
  cronogramaItemRevisoesRepo,
  cronogramaCenariosRepo,
  cronogramaCenarioItensRepo,
  CRONOGRAMA_COLUNAS_DASHBOARD,
  CRONOGRAMA_ITENS_COLUNAS,
} from "@/lib/repositories/cronograma";

describe("TST-002.i · boardListasRepo", () => {
  beforeEach(() => reset());

  it("create() faz insert em board_listas", async () => {
    await boardListasRepo.create({ board_id: "b1", nome: "L", posicao: 0 } as any);
    expect(recorded[0].table).toBe("board_listas");
    expect(recorded[0].ops).toEqual([
      { op: "insert", args: [{ board_id: "b1", nome: "L", posicao: 0 }] },
    ]);
  });

  it("create() propaga erro", async () => {
    reset({ data: null, error: new Error("x") });
    await expect(boardListasRepo.create({} as any)).rejects.toThrow("x");
  });

  it("insertMany() no-op para array vazio; envia array cheio", async () => {
    await boardListasRepo.insertMany([]);
    expect(recorded).toHaveLength(0);

    await boardListasRepo.insertMany([{ nome: "A" } as any, { nome: "B" } as any]);
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [[{ nome: "A" }, { nome: "B" }]],
    });
  });

  it("update() aplica patch por id", async () => {
    await boardListasRepo.update("l1", { nome: "X" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ nome: "X" }] },
      { op: "eq", args: ["id", "l1"] },
    ]);
  });

  it("updatePosicao() atualiza apenas o campo posicao", async () => {
    await boardListasRepo.updatePosicao("l1", 3);
    expect(recorded[0].table).toBe("board_listas");
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ posicao: 3 }] },
      { op: "eq", args: ["id", "l1"] },
    ]);
  });
});

describe("TST-002.i · boardCamposRepo/boardMembrosRepo", () => {
  beforeEach(() => reset());

  it("boardCamposRepo.insert usa board_campos", async () => {
    await boardCamposRepo.insert({ board_id: "b", nome: "n" });
    expect(recorded[0].table).toBe("board_campos");
    expect(recorded[0].ops[0].op).toBe("insert");
  });

  it("boardCamposRepo.remove usa delete().eq('id',...)", async () => {
    await boardCamposRepo.remove("c1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "c1"] },
    ]);
  });

  it("boardMembrosRepo.insert é idempotente por (board_id, user_id)", async () => {
    // Apesar do nome, grava por upsert: readicionar quem já é membro do quadro
    // devolvia 409. O `onConflict` é o que carrega essa garantia — por isso a
    // asserção não para no nome da operação.
    await boardMembrosRepo.insert({ board_id: "b", user_id: "u" });
    expect(recorded[0].table).toBe("board_membros");
    expect(recorded[0].ops).toEqual([
      {
        op: "upsert",
        args: [{ board_id: "b", user_id: "u" }, { onConflict: "board_id,user_id" }],
      },
    ]);
  });
});

describe("TST-002.i · cronogramaRepo — leituras", () => {
  beforeEach(() => reset());

  it("listByObra() usa colunas completas, filtra obra_id e ordena data_inicio", async () => {
    reset({ data: [{ id: "c1" }], error: null });
    const out = await cronogramaRepo.listByObra("o1");

    expect(out).toEqual([{ id: "c1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("cronograma_itens");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(rec.ops[0].args[0]).toBe(CRONOGRAMA_ITENS_COLUNAS);
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args).toEqual(["data_inicio"]);
  });

  it("listByObra() devolve [] em data null", async () => {
    reset({ data: null, error: null });
    const out = await cronogramaRepo.listByObra("o1");
    expect(out).toEqual([]);
  });

  it("listByObra() propaga erro", async () => {
    reset({ data: null, error: new Error("q") });
    await expect(cronogramaRepo.listByObra("o1")).rejects.toThrow("q");
  });

  it("listDashboard() usa CRONOGRAMA_COLUNAS_DASHBOARD e devolve [] em null", async () => {
    reset({ data: null, error: null });
    const out = await cronogramaRepo.listDashboard();
    expect(out).toEqual([]);
    expect(recorded[0].ops[0].args[0]).toBe(CRONOGRAMA_COLUNAS_DASHBOARD);
    // O Dashboard mostra só item ativo.
    expect(recorded[0].ops[1]).toEqual({ op: "neq", args: ["ativo", false] });
  });

  it("listDashboard() pagina até a página vir curta", async () => {
    // O PostgREST corta a resposta em 1.000 linhas. Sem paginar, obras a partir
    // da ~3ª chegavam ao Dashboard sem item nenhum — e sem erro nenhum.
    const paginaCheia = Array.from({ length: 1000 }, (_, i) => ({ id: `i${i}` }));
    enfileirar({ data: paginaCheia, error: null }, { data: [{ id: "ultimo" }], error: null });

    const out = await cronogramaRepo.listDashboard();

    expect(out).toHaveLength(1001);
    expect(out.at(-1)).toEqual({ id: "ultimo" });
    // Duas idas ao banco: a segunda só acontece porque a primeira veio cheia.
    expect(recorded).toHaveLength(2);
    expect(recorded[0].ops.at(-1)).toEqual({ op: "range", args: [0, 999] });
    expect(recorded[1].ops.at(-1)).toEqual({ op: "range", args: [1000, 1999] });
  });

  it("listResumoPacotes() usa projeção mínima", async () => {
    await cronogramaRepo.listResumoPacotes();
    expect(recorded[0].ops[0].args[0]).toBe("id, descricao, obra_id");
  });

  it("listIdsPorObra() usa select('id').eq(obra_id) e devolve [] em null", async () => {
    reset({ data: null, error: null });
    const out = await cronogramaRepo.listIdsPorObra("o1");
    expect(out).toEqual([]);
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id"] },
      { op: "eq", args: ["obra_id", "o1"] },
    ]);
  });
});

describe("TST-002.i · cronogramaRepo — mutações", () => {
  beforeEach(() => reset());

  it("create() faz insert simples", async () => {
    await cronogramaRepo.create({ obra_id: "o1" } as any);
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [{ obra_id: "o1" }],
    });
  });

  it("insertMany() no-op vazio, envia array cheio", async () => {
    await cronogramaRepo.insertMany([]);
    expect(recorded).toHaveLength(0);

    await cronogramaRepo.insertMany([{ id: "a" } as any]);
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [[{ id: "a" }]],
    });
  });

  it("update() patch por id", async () => {
    await cronogramaRepo.update("c1", { descricao: "x" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ descricao: "x" }] },
      { op: "eq", args: ["id", "c1"] },
    ]);
  });

  it("remove() delete por id", async () => {
    await cronogramaRepo.remove("c1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "c1"] },
    ]);
  });

  it("removeByObra() delete por obra_id", async () => {
    await cronogramaRepo.removeByObra("o1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["obra_id", "o1"] },
    ]);
  });

  it("removeMany() no-op vazio; usa in('id', ids)", async () => {
    await cronogramaRepo.removeMany([]);
    expect(recorded).toHaveLength(0);

    await cronogramaRepo.removeMany(["a", "b"]);
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "in", args: ["id", ["a", "b"]] },
    ]);
  });

  it("update/remove propagam erro", async () => {
    reset({ data: null, error: new Error("u") });
    await expect(cronogramaRepo.update("c", {} as any)).rejects.toThrow("u");
    reset({ data: null, error: new Error("d") });
    await expect(cronogramaRepo.remove("c")).rejects.toThrow("d");
  });
});

describe("TST-002.i · cronograma — revisões e cenários", () => {
  beforeEach(() => reset());

  it("itemRevisoesRepo.insertMany no-op vazio; envia array", async () => {
    await cronogramaItemRevisoesRepo.insertMany([]);
    expect(recorded).toHaveLength(0);

    await cronogramaItemRevisoesRepo.insertMany([{ x: 1 }]);
    expect(recorded[0].table).toBe("cronograma_item_revisoes");
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [[{ x: 1 }]] });
  });

  it("itemRevisoesRepo.removeByRevisao usa delete().eq('revisao_id',...)", async () => {
    await cronogramaItemRevisoesRepo.removeByRevisao("r1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["revisao_id", "r1"] },
    ]);
  });

  it("itemRevisoesRepo.removeByRevisaoIds no-op vazio; usa in()", async () => {
    await cronogramaItemRevisoesRepo.removeByRevisaoIds([]);
    expect(recorded).toHaveLength(0);

    await cronogramaItemRevisoesRepo.removeByRevisaoIds(["r1", "r2"]);
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "in", args: ["revisao_id", ["r1", "r2"]] },
    ]);
  });

  it("cenariosRepo.remove usa delete().eq('id',...)", async () => {
    await cronogramaCenariosRepo.remove("cen1");
    expect(recorded[0].table).toBe("cronograma_cenarios");
    expect(recorded[0].ops[1].args).toEqual(["id", "cen1"]);
  });

  it("cenarioItensRepo.insertMany no-op vazio; envia array", async () => {
    await cronogramaCenarioItensRepo.insertMany([]);
    expect(recorded).toHaveLength(0);

    await cronogramaCenarioItensRepo.insertMany([{ y: 2 }]);
    expect(recorded[0].table).toBe("cronograma_cenario_itens");
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [[{ y: 2 }]] });
  });
});
