/**
 * TST-002 (lote N) — Contratos dos métodos adicionados no ARC-003:
 *  · `obrasRepo.getResumoRdo`
 *  · `pacotesTrabalhoRepo.{listJanela, updateSemana, listParaReplicar, insertMany}`
 *  · `riscosRepo.listFull`
 *  · `licoesAprendidasRepo.listCompleta`
 *  · `cronogramaRepo.updateDatasOtimista`
 *  · `cronogramaDependenciasRepo.{insertOne, updateByKey, deleteByKey}`
 *
 * Fecha a lacuna deixada em L (que já cobria a base). Testa forma da chamada
 * (tabela, colunas, filtros, ordenação) + propagação de erro e semântica de
 * versão otimista.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { obrasRepo } from "@/lib/repositories/obras";
import {
  riscosRepo,
  licoesAprendidasRepo,
  pacotesTrabalhoRepo,
} from "@/lib/repositories/planejamento";
import {
  cronogramaRepo,
  cronogramaDependenciasRepo,
} from "@/lib/repositories/cronograma";

describe("TST-002.n · obrasRepo.getResumoRdo", () => {
  beforeEach(() => reset());

  it("projeta nome, empresa_id e usa maybeSingle()", async () => {
    reset({ data: { nome: "Obra 1", empresa_id: "e1" }, error: null });
    const out = await obrasRepo.getResumoRdo("o1");
    expect(out).toEqual({ nome: "Obra 1", empresa_id: "e1" });
    const rec = recorded[0];
    expect(rec.table).toBe("obras");
    expect(rec.ops).toEqual([
      { op: "select", args: ["nome, empresa_id"] },
      { op: "eq", args: ["id", "o1"] },
      { op: "maybeSingle", args: [] },
    ]);
  });

  it("retorna null quando data é null; propaga erro", async () => {
    reset({ data: null, error: null });
    expect(await obrasRepo.getResumoRdo("x")).toBeNull();
    reset({ data: null, error: new Error("boom") });
    await expect(obrasRepo.getResumoRdo("x")).rejects.toThrow("boom");
  });
});

describe("TST-002.n · riscosRepo.listFull / licoesAprendidasRepo.listCompleta", () => {
  beforeEach(() => reset());

  it("riscos.listFull ordena por created_at desc e propaga erro", async () => {
    reset({ data: [{ id: "r1" }], error: null });
    const out = await riscosRepo.listFull();
    expect(out).toEqual([{ id: "r1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("riscos");
    expect(rec.ops[0].op).toBe("select");
    expect(rec.ops[1]).toEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
    reset({ data: null, error: new Error("e") });
    await expect(riscosRepo.listFull()).rejects.toThrow("e");
  });

  it("licoesAprendidas.listCompleta ordena por data_registro desc; [] em data null", async () => {
    reset({ data: null, error: null });
    expect(await licoesAprendidasRepo.listCompleta()).toEqual([]);
    const rec = recorded[0];
    expect(rec.table).toBe("licoes_aprendidas");
    expect(rec.ops[1]).toEqual({
      op: "order",
      args: ["data_registro", { ascending: false }],
    });
  });
});

describe("TST-002.n · pacotesTrabalhoRepo (Lookahead)", () => {
  beforeEach(() => reset());

  it("listJanela devolve { data, error } aplicando gte/lte/order", async () => {
    reset({ data: [{ id: "p1" }], error: null });
    const out = await pacotesTrabalhoRepo.listJanela("2026-01-01", "2026-01-14");
    expect(out.data).toEqual([{ id: "p1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("pacotes_trabalho");
    expect(rec.ops).toEqual([
      {
        op: "select",
        args: ["id, obra_id, descricao, semana_inicio, semana_fim, status"],
      },
      { op: "gte", args: ["semana_fim", "2026-01-01"] },
      { op: "lte", args: ["semana_inicio", "2026-01-14"] },
      { op: "order", args: ["semana_inicio"] },
    ]);
  });

  it("listJanela devolve error e data=[] quando a query falha", async () => {
    const err = new Error("net");
    reset({ data: null, error: err });
    const out = await pacotesTrabalhoRepo.listJanela("a", "b");
    expect(out.data).toEqual([]);
    expect(out.error).toBe(err);
  });

  it("updateSemana envia patch mínimo e filtra por id", async () => {
    await pacotesTrabalhoRepo.updateSemana("p1", "2026-02-01", "2026-02-07");
    const rec = recorded[0];
    expect(rec.ops).toEqual([
      { op: "update", args: [{ semana_inicio: "2026-02-01", semana_fim: "2026-02-07" }] },
      { op: "eq", args: ["id", "p1"] },
    ]);
    reset({ data: null, error: new Error("x") });
    await expect(pacotesTrabalhoRepo.updateSemana("p", "a", "b")).rejects.toThrow("x");
  });

  it("listParaReplicar projeta campos de replicação e filtra por ids in()", async () => {
    reset({ data: [{ descricao: "d" }], error: null });
    const out = await pacotesTrabalhoRepo.listParaReplicar(["a", "b"]);
    expect(out).toEqual([{ descricao: "d" }]);
    const rec = recorded[0];
    expect(rec.ops[0].op).toBe("select");
    expect(rec.ops[1]).toEqual({ op: "in", args: ["id", ["a", "b"]] });
    reset({ data: null, error: new Error("y") });
    await expect(pacotesTrabalhoRepo.listParaReplicar(["a"])).rejects.toThrow("y");
  });

  it("insertMany propaga erro do supabase", async () => {
    await pacotesTrabalhoRepo.insertMany([{ descricao: "x" }]);
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [[{ descricao: "x" }]] });
    reset({ data: null, error: new Error("z") });
    await expect(pacotesTrabalhoRepo.insertMany([{ a: 1 }])).rejects.toThrow("z");
  });
});

describe("TST-002.n · cronogramaRepo.updateDatasOtimista", () => {
  beforeEach(() => reset());

  it("com prevVersao aplica filtro versao_otimista e retorna ok=true quando afeta linha", async () => {
    reset({ data: [{ id: "c1" }], error: null });
    const out = await cronogramaRepo.updateDatasOtimista("c1", 3, {
      data_inicio: "2026-01-01",
      data_fim: "2026-01-05",
    });
    expect(out).toEqual({ ok: true });
    const rec = recorded[0];
    expect(rec.table).toBe("cronograma_itens");
    expect(rec.ops).toEqual([
      { op: "update", args: [{ data_inicio: "2026-01-01", data_fim: "2026-01-05" }] },
      { op: "eq", args: ["id", "c1"] },
      { op: "eq", args: ["versao_otimista", 3] },
      { op: "select", args: ["id"] },
    ]);
  });

  it("sem prevVersao não filtra por versao_otimista", async () => {
    reset({ data: [{ id: "c1" }], error: null });
    await cronogramaRepo.updateDatasOtimista("c1", null, {
      data_inicio: "d1",
      data_fim: "d2",
    });
    const ops = recorded[0].ops.map((o) => o.op);
    // update, eq(id), select — sem segundo eq
    expect(ops).toEqual(["update", "eq", "select"]);
  });

  it("retorna ok=false quando 0 linhas afetadas (conflito de versão)", async () => {
    reset({ data: [], error: null });
    const out = await cronogramaRepo.updateDatasOtimista("c1", 9, {
      data_inicio: "d1",
      data_fim: "d2",
    });
    expect(out).toEqual({ ok: false });
  });

  it("retorna ok=false com mensagem quando erro do driver", async () => {
    reset({ data: null, error: { message: "conflict" } });
    const out = await cronogramaRepo.updateDatasOtimista("c1", 1, {
      data_inicio: "d1",
      data_fim: "d2",
    });
    expect(out).toEqual({ ok: false, error: "conflict" });
  });
});

describe("TST-002.n · cronogramaDependenciasRepo", () => {
  beforeEach(() => reset());

  it("insertOne devolve {} em sucesso e { error } com mensagem em falha", async () => {
    expect(await cronogramaDependenciasRepo.insertOne({ a: 1 })).toEqual({});
    expect(recorded[0].table).toBe("cronograma_dependencias");
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ a: 1 }] });
    reset({ data: null, error: { message: "dup" } });
    expect(await cronogramaDependenciasRepo.insertOne({ a: 2 })).toEqual({ error: "dup" });
  });

  it("updateByKey filtra por obra_id, predecessor_item_id e item_id", async () => {
    const out = await cronogramaDependenciasRepo.updateByKey("o1", "p1", "i1", { lag: 2 });
    expect(out).toEqual({});
    const rec = recorded[0];
    expect(rec.ops).toEqual([
      { op: "update", args: [{ lag: 2 }] },
      { op: "eq", args: ["obra_id", "o1"] },
      { op: "eq", args: ["predecessor_item_id", "p1"] },
      { op: "eq", args: ["item_id", "i1"] },
    ]);
  });

  it("deleteByKey usa mesma chave composta e propaga error como mensagem", async () => {
    reset({ data: null, error: { message: "denied" } });
    const out = await cronogramaDependenciasRepo.deleteByKey("o1", "p1", "i1");
    expect(out).toEqual({ error: "denied" });
    const rec = recorded[0];
    expect(rec.ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["obra_id", "o1"] },
      { op: "eq", args: ["predecessor_item_id", "p1"] },
      { op: "eq", args: ["item_id", "i1"] },
    ]);
  });
});
