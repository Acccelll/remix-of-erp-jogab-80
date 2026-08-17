/**
 * TST-002 (lote E) — Testes de integração dos repositories `financeiro`
 * e da fatia `obraDetalhe` (maiores superfícies agregadas antes da Onda 6).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset, enfileirar } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { financeiroRepo } from "@/lib/repositories/financeiro";
import {
  aditivosContratoRepo,
  bmsPrevistasRepo,
  cronogramaMarcosRepo,
  importValidationRunsRepo,
  obraLocalizacoesRepo,
  ocorrenciasRepo,
  rdoEfetivoRepo,
  rdoOcorrenciasRepo,
} from "@/lib/repositories/obraDetalhe";

describe("TST-002.e · financeiroRepo — contrato de query", () => {
  beforeEach(() => reset());

  it("listLancamentosPorObra() filtra obra_id e ordena data_lancamento desc", async () => {
    reset({ data: [{ id: "l1" }], error: null });
    const out = await financeiroRepo.listLancamentosPorObra("o1");
    expect(out).toEqual([{ id: "l1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("financeiro_lancamentos");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order", "limit"]);
    expect(String(rec.ops[0].args[0])).toContain("data_lancamento");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args).toEqual(["data_lancamento", { ascending: false }]);
  });

  it("listLancamentosPorObra() propaga erro do backend", async () => {
    reset({ data: null, error: new Error("rls") });
    await expect(financeiroRepo.listLancamentosPorObra("o1")).rejects.toThrow("rls");
  });

  it("listLancamentosPorSnapshot() pagina, filtra snapshot/status/obra e concatena", async () => {
    enfileirar(
      { data: [{ id: "a" }, { id: "b" }], error: null },
      { data: [{ id: "c" }], error: null },
    );
    const out = await financeiroRepo.listLancamentosPorSnapshot({
      snapshotId: "s1",
      obraId: "o1",
      excludeStatusCod: 9,
      cols: "id",
      pageSize: 2,
    });
    expect(out).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(recorded).toHaveLength(2);
    expect(recorded[0].table).toBe("financeiro_lancamentos");
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["select", "eq", "range", "neq", "eq"]);
    expect(recorded[0].ops[1].args).toEqual(["snapshot_id", "s1"]);
    expect(recorded[0].ops[2].args).toEqual([0, 1]);
    expect(recorded[0].ops[3].args).toEqual(["status_cod", 9]);
    expect(recorded[0].ops[4].args).toEqual(["obra_id", "o1"]);
    expect(recorded[1].ops.find((o) => o.op === "range")?.args).toEqual([2, 3]);
  });

  it("listLancamentosPorSnapshot() para quando a primeira página vem vazia", async () => {
    reset({ data: [], error: null });
    const out = await financeiroRepo.listLancamentosPorSnapshot({ snapshotId: "s1", pageSize: 50 });
    expect(out).toEqual([]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["select", "eq", "range"]);
    expect(recorded[0].ops.find((o) => o.op === "range")?.args).toEqual([0, 49]);
  });

  it("listLancamentosPorSnapshot() propaga erro da página", async () => {
    reset({ data: null, error: new Error("snapshot denied") });
    await expect(financeiroRepo.listLancamentosPorSnapshot({ snapshotId: "s1" })).rejects.toThrow("snapshot denied");
  });

  it("listMatrizRateios() pagina matriz e concatena páginas", async () => {
    enfileirar(
      { data: [{ ref_lancamento: "1" }, { ref_lancamento: "2" }], error: null },
      { data: [], error: null },
    );
    const out = await financeiroRepo.listMatrizRateios("ref_lancamento", 2);
    expect(out).toEqual([{ ref_lancamento: "1" }, { ref_lancamento: "2" }]);
    expect(recorded).toHaveLength(2);
    expect(recorded[0].table).toBe("financeiro_matriz_rateios");
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["select", "range"]);
    expect(recorded[0].ops[0].args[0]).toBe("ref_lancamento");
    expect(recorded[1].ops.find((o) => o.op === "range")?.args).toEqual([2, 3]);
  });

  it("listMatrizRateios() propaga erro", async () => {
    reset({ data: null, error: new Error("matriz") });
    await expect(financeiroRepo.listMatrizRateios()).rejects.toThrow("matriz");
  });

  it("listSnapshots() ordena mes_competencia desc", async () => {
    reset({ data: [{ id: "s1" }], error: null });
    expect(await financeiroRepo.listSnapshots()).toEqual([{ id: "s1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("financeiro_snapshots");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order", "limit"]);
    expect(rec.ops[1].args).toEqual(["mes_competencia", { ascending: false }]);
  });

  it("vwObra() consulta visão financeira por obra_id", async () => {
    reset({ data: [{ obra_id: "o1" }], error: null });
    expect(await financeiroRepo.vwObra("o1")).toEqual([{ obra_id: "o1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("vw_financeiro_obra");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "limit"]);
    expect(String(rec.ops[0].args[0])).toContain("valor_rateio");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
  });
});

describe("TST-002.e · obraDetalhe — contratos de escrita", () => {
  beforeEach(() => reset());

  it("ocorrenciasRepo.upsert() atualiza quando há id", async () => {
    await ocorrenciasRepo.upsert("oc1", { descricao: "x" });
    const rec = recorded[0];
    expect(rec.table).toBe("ocorrencias");
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[0].args[0]).toEqual({ descricao: "x" });
    expect(rec.ops[1].args).toEqual(["id", "oc1"]);
  });

  it("ocorrenciasRepo.upsert() insere quando id é ausente", async () => {
    await ocorrenciasRepo.upsert(null, { obra_id: "o1" });
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["insert"]);
    expect(rec.ops[0].args[0]).toEqual({ obra_id: "o1" });
  });

  it("ocorrenciasRepo.remove() remove por id e propaga erro", async () => {
    reset({ data: null, error: new Error("remove") });
    await expect(ocorrenciasRepo.remove("oc1")).rejects.toThrow("remove");
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(recorded[0].ops[1].args).toEqual(["id", "oc1"]);
  });

  it("obraLocalizacoesRepo.rename()/reorder()/remove() usam id como chave", async () => {
    await obraLocalizacoesRepo.rename("loc1", "Frente A");
    await obraLocalizacoesRepo.reorder("loc1", 3);
    await obraLocalizacoesRepo.remove("loc1");
    expect(recorded.map((r) => r.table)).toEqual([
      "obra_localizacoes",
      "obra_localizacoes",
      "obra_localizacoes",
    ]);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ nome: "Frente A" }] },
      { op: "eq", args: ["id", "loc1"] },
    ]);
    expect(recorded[1].ops).toEqual([
      { op: "update", args: [{ ordem: 3 }] },
      { op: "eq", args: ["id", "loc1"] },
    ]);
    expect(recorded[2].ops.map((o) => o.op)).toEqual(["delete", "eq"]);
  });

  it("aditivosContratoRepo.listPorObra() seleciona colunas explícitas e ordena por numero", async () => {
    reset({ data: [{ id: "a1" }], error: null });
    expect(await aditivosContratoRepo.listPorObra("o1")).toEqual([{ id: "a1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("aditivos_contrato");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(String(rec.ops[0].args[0])).toContain("valor_financeiro");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args[0]).toBe("numero");
  });

  it("aditivosContratoRepo.insert() emite insert e propaga erro", async () => {
    reset({ data: null, error: new Error("aditivo") });
    await expect(aditivosContratoRepo.insert({ obra_id: "o1" })).rejects.toThrow("aditivo");
    expect(recorded[0].ops).toEqual([{ op: "insert", args: [{ obra_id: "o1" }] }]);
  });

  it("bmsPrevistasRepo.listComObras() inclui join de obras", async () => {
    reset({ data: [{ id: "bm1" }], error: null });
    expect(await bmsPrevistasRepo.listComObras()).toEqual([{ id: "bm1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("bms_previstas");
    expect(rec.ops.map((o) => o.op)).toEqual(["select"]);
    expect(String(rec.ops[0].args[0])).toContain("obras(id,codigo,nome,cliente_id)");
  });

  it("bmsPrevistasRepo.deletePrevistasPorObra() filtra obra e status prevista", async () => {
    await bmsPrevistasRepo.deletePrevistasPorObra("o1");
    const rec = recorded[0];
    expect(rec.ops.map((o) => o.op)).toEqual(["delete", "eq", "eq"]);
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args).toEqual(["status", "prevista"]);
  });

  it("bmsPrevistasRepo.upsertPorObraNumero() usa conflito obra_id,numero", async () => {
    await bmsPrevistasRepo.upsertPorObraNumero([{ obra_id: "o1", numero: 1 }]);
    const rec = recorded[0];
    expect(rec.table).toBe("bms_previstas");
    expect(rec.ops).toEqual([
      {
        op: "upsert",
        args: [[{ obra_id: "o1", numero: 1 }], { onConflict: "obra_id,numero", ignoreDuplicates: true }],
      },
    ]);
  });
});

describe("TST-002.e · obraDetalhe — consultas auxiliares", () => {
  beforeEach(() => reset());

  it("cronogramaMarcosRepo.listPorObra() filtra obra_id e ordena ordem", async () => {
    reset({ data: [{ id: "m1" }], error: null });
    expect(await cronogramaMarcosRepo.listPorObra("o1")).toEqual([{ id: "m1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("cronograma_marcos");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(String(rec.ops[0].args[0])).toContain("data_realizado");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args[0]).toBe("ordem");
  });

  it("cronogramaMarcosRepo.upsert() escolhe update ou insert", async () => {
    await cronogramaMarcosRepo.upsert("m1", { nome: "Marco" });
    await cronogramaMarcosRepo.upsert(undefined, { nome: "Novo" });
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ nome: "Marco" }] },
      { op: "eq", args: ["id", "m1"] },
    ]);
    expect(recorded[1].ops).toEqual([{ op: "insert", args: [{ nome: "Novo" }] }]);
  });

  it("cronogramaMarcosRepo.updateRealizado() grava apenas data_realizado", async () => {
    await cronogramaMarcosRepo.updateRealizado("m1", null);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ data_realizado: null }] },
      { op: "eq", args: ["id", "m1"] },
    ]);
  });

  it("rdoEfetivoRepo.listPorRdos() curto-circuita sem ids", async () => {
    expect(await rdoEfetivoRepo.listPorRdos([])).toEqual([]);
    expect(recorded).toHaveLength(0);
  });

  it("rdoEfetivoRepo.listPorRdos() usa in(rdo_id, ids)", async () => {
    reset({ data: [{ rdo_id: "r1" }], error: null });
    expect(await rdoEfetivoRepo.listPorRdos(["r1", "r2"])).toEqual([{ rdo_id: "r1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("rdo_efetivo");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "in"]);
    expect(rec.ops[1].args).toEqual(["rdo_id", ["r1", "r2"]]);
  });

  it("rdoOcorrenciasRepo.listPorRdos() curto-circuita sem ids", async () => {
    expect(await rdoOcorrenciasRepo.listPorRdos([])).toEqual([]);
    expect(recorded).toHaveLength(0);
  });

  it("rdoOcorrenciasRepo.listPorRdos() usa colunas mínimas e in(rdo_id)", async () => {
    reset({ data: [{ rdo_id: "r1" }], error: null });
    expect(await rdoOcorrenciasRepo.listPorRdos(["r1"])).toEqual([{ rdo_id: "r1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("rdo_ocorrencias");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "in"]);
    expect(rec.ops[0].args[0]).toBe("rdo_id, tipo, descricao");
    expect(rec.ops[1].args).toEqual(["rdo_id", ["r1"]]);
  });

  it("importValidationRunsRepo.insert() devolve resultado bruto do backend", async () => {
    reset({ data: [{ id: "run1" }], error: null });
    expect(await importValidationRunsRepo.insert({ arquivo: "x.xlsx" })).toEqual({
      data: [{ id: "run1" }],
      error: null,
    });
    const rec = recorded[0];
    expect(rec.table).toBe("import_validation_runs");
    expect(rec.ops).toEqual([{ op: "insert", args: [{ arquivo: "x.xlsx" }] }]);
  });
});