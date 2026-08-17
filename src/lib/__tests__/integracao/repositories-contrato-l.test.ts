/**
 * TST-002 (lote L) — Contratos de `insumosRepo`, `requisicoesRepo` e do
 * módulo `planejamento` (riscos, lições, pacotes, restrições, pacote-restrições,
 * compromissos semanais, causas). Fecha a bateria pré-Onda 6.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { insumosRepo } from "@/lib/repositories/insumos";
import { requisicoesRepo } from "@/lib/repositories/requisicoes";
import {
  riscosRepo,
  licoesAprendidasRepo,
  pacotesTrabalhoRepo,
  restricoesRepo,
  pacoteRestricoesRepo,
  compromissosSemanaisRepo,
  causasNaoConclusaoRepo,
} from "@/lib/repositories/planejamento";

describe("TST-002.l · insumosRepo", () => {
  beforeEach(() => reset());

  it("listAtivos() filtra ativo=true, colunas fixas e ordena descricao", async () => {
    reset({ data: [{ id: "i1" }], error: null });
    const out = await insumosRepo.listAtivos();
    expect(out).toEqual([{ id: "i1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("insumos");
    expect(rec.ops).toEqual([
      { op: "select", args: ["id, descricao, unidade, preco_unitario, ativo"] },
      { op: "eq", args: ["ativo", true] },
      { op: "order", args: ["descricao"] },
      { op: "limit", args: [expect.any(Number)] },
    ]);
  });

  it("listAtivos() devolve [] em data null e propaga erro", async () => {
    reset({ data: null, error: null });
    expect(await insumosRepo.listAtivos()).toEqual([]);
    reset({ data: null, error: new Error("x") });
    await expect(insumosRepo.listAtivos()).rejects.toThrow("x");
  });

  it("listPrecos() usa projeção mínima", async () => {
    await insumosRepo.listPrecos();
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id, preco_unitario"] },
      { op: "limit", args: [expect.any(Number)] },
    ]);
  });

  it("listResumoPrecos() inclui descricao/unidade", async () => {
    await insumosRepo.listResumoPrecos();
    expect(recorded[0].ops[0].args[0]).toBe(
      "id, descricao, unidade, preco_unitario",
    );
  });

  it("create/update/toggleAtivo com verbos e filtros corretos", async () => {
    await insumosRepo.create({ descricao: "X" } as any);
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ descricao: "X" }] });

    reset();
    await insumosRepo.update("i1", { preco_unitario: 10 } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ preco_unitario: 10 }] },
      { op: "eq", args: ["id", "i1"] },
    ]);

    reset();
    await insumosRepo.toggleAtivo("i1", false);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ ativo: false }] },
      { op: "eq", args: ["id", "i1"] },
    ]);
  });
});

describe("TST-002.l · requisicoesRepo", () => {
  beforeEach(() => reset());

  it("listAll() usa colunas padrão e ordena created_at desc", async () => {
    reset({ data: [{ id: "r1" }], error: null });
    const out = await requisicoesRepo.listAll();
    expect(out).toEqual([{ id: "r1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("requisicoes");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order", "limit"]);
    expect(rec.ops[0].args[0]).toBe(
      "id, obra_id, card_recurso_id, orcamento_item_id, insumo_id, quantidade, status, observacao, created_at, updated_at",
    );
    expect(rec.ops[1].args).toEqual(["created_at", { ascending: false }]);
  });

  it("listAll() aceita override e propaga erro", async () => {
    await requisicoesRepo.listAll("id, status");
    expect(recorded[0].ops[0].args[0]).toBe("id, status");

    reset({ data: null, error: new Error("l") });
    await expect(requisicoesRepo.listAll()).rejects.toThrow("l");
  });

  it("listResumoObra() aplica limit padrão 500 e devolve [] em data null", async () => {
    reset({ data: null, error: null });
    const out = await requisicoesRepo.listResumoObra();
    expect(out).toEqual([]);
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id, obra_id, observacao"] },
      { op: "limit", args: [500] },
    ]);
  });

  it("listResumoObra() aceita limit custom", async () => {
    await requisicoesRepo.listResumoObra(50);
    expect(recorded[0].ops[1].args).toEqual([50]);
  });

  it("create/update/updateStatus com verbos corretos", async () => {
    await requisicoesRepo.create({ obra_id: "o1" } as any);
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ obra_id: "o1" }] });

    reset();
    await requisicoesRepo.updateStatus("r1", "aprovado");
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ status: "aprovado" }] },
      { op: "eq", args: ["id", "r1"] },
    ]);

    reset();
    await requisicoesRepo.update("r1", { quantidade: 5 } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ quantidade: 5 }] },
      { op: "eq", args: ["id", "r1"] },
    ]);
  });
});

describe("TST-002.l · riscosRepo & licoesAprendidasRepo", () => {
  beforeEach(() => reset());

  it("riscos.listDashboard() usa colunas fixas", async () => {
    await riscosRepo.listDashboard();
    expect(recorded[0].table).toBe("riscos");
    expect(recorded[0].ops[0].args[0]).toBe(
      "id, obra_id, probabilidade, impacto, status, descricao",
    );
  });

  it("riscos.listResumoDescricao() usa projeção mínima", async () => {
    await riscosRepo.listResumoDescricao();
    expect(recorded[0].ops[0].args[0]).toBe("id, descricao, obra_id");
  });

  it("riscos.upsert(): sem id → insert; com id → update().eq('id',...)", async () => {
    await riscosRepo.upsert(null, { descricao: "d" } as any);
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ descricao: "d" }] });

    reset();
    await riscosRepo.upsert("r1", { descricao: "e" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ descricao: "e" }] },
      { op: "eq", args: ["id", "r1"] },
    ]);
  });

  it("riscos.upsert() propaga erro", async () => {
    reset({ data: null, error: new Error("u") });
    await expect(riscosRepo.upsert("r1", {} as any)).rejects.toThrow("u");
  });

  it("riscos.remove() usa delete().eq('id',...)", async () => {
    await riscosRepo.remove("r1");
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "r1"] },
    ]);
  });

  it("licoes.upsert/remove usam tabela licoes_aprendidas", async () => {
    await licoesAprendidasRepo.upsert(null, { titulo: "t" } as any);
    expect(recorded[0].table).toBe("licoes_aprendidas");
    expect(recorded[0].ops[0].op).toBe("insert");

    reset();
    await licoesAprendidasRepo.upsert("l1", { titulo: "u" } as any);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ titulo: "u" }] },
      { op: "eq", args: ["id", "l1"] },
    ]);

    reset();
    await licoesAprendidasRepo.remove("l1");
    expect(recorded[0].ops[0].op).toBe("delete");
    expect(recorded[0].ops[1].args).toEqual(["id", "l1"]);
  });
});

describe("TST-002.l · pacotesTrabalho, restricoes, pacoteRestricoes", () => {
  beforeEach(() => reset());

  it("pacotesTrabalho.listDescricao/listResumoObra/listObra usam projeções corretas", async () => {
    await pacotesTrabalhoRepo.listDescricao();
    expect(recorded[0].table).toBe("pacotes_trabalho");
    expect(recorded[0].ops[0].args[0]).toBe("id, descricao");

    reset();
    await pacotesTrabalhoRepo.listResumoObra();
    expect(recorded[0].ops[0].args[0]).toBe(
      "id, descricao, obra_id, semana_inicio",
    );

    reset();
    await pacotesTrabalhoRepo.listObra();
    expect(recorded[0].ops[0].args[0]).toBe("id, obra_id");
  });

  it("pacotesTrabalho.upsert alterna insert/update", async () => {
    await pacotesTrabalhoRepo.upsert(null, { descricao: "d" });
    expect(recorded[0].ops[0].op).toBe("insert");

    reset();
    await pacotesTrabalhoRepo.upsert("p1", { descricao: "e" });
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ descricao: "e" }] },
      { op: "eq", args: ["id", "p1"] },
    ]);
  });

  it("pacotesTrabalho.updateStatus atualiza campo status", async () => {
    await pacotesTrabalhoRepo.updateStatus("p1", "concluido");
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ status: "concluido" }] },
      { op: "eq", args: ["id", "p1"] },
    ]);
  });

  it("restricoes: listResumo/listDashboard/listCurto usam projeções fixas", async () => {
    await restricoesRepo.listResumo();
    expect(recorded[0].table).toBe("restricoes");
    expect(recorded[0].ops[0].args[0]).toBe(
      "id, tipo, status, prazo, descricao",
    );

    reset();
    await restricoesRepo.listDashboard();
    expect(recorded[0].ops[0].args[0]).toBe("id, obra_id, tipo, status, prazo");

    reset();
    await restricoesRepo.listCurto();
    expect(recorded[0].ops[0].args[0]).toBe("id, tipo, status, prazo");
  });

  it("restricoes.upsert e updateStatus", async () => {
    await restricoesRepo.upsert(null, { tipo: "t" });
    expect(recorded[0].ops[0].op).toBe("insert");

    reset();
    await restricoesRepo.upsert("x1", { tipo: "t" });
    expect(recorded[0].ops[0].op).toBe("update");
    expect(recorded[0].ops[1].args).toEqual(["id", "x1"]);

    reset();
    await restricoesRepo.updateStatus("x1", "resolvida");
    expect(recorded[0].ops[0]).toEqual({
      op: "update",
      args: [{ status: "resolvida" }],
    });
  });

  it("pacoteRestricoes.listComData e listDashboard", async () => {
    await pacoteRestricoesRepo.listComData();
    expect(recorded[0].table).toBe("pacote_restricoes");
    expect(recorded[0].ops[0].args[0]).toBe(
      "pacote_id, restricao_id, created_at",
    );

    reset();
    await pacoteRestricoesRepo.listDashboard();
    expect(recorded[0].ops[0].args[0]).toBe("pacote_id, restricao_id");
  });
});

describe("TST-002.l · compromissosSemanais & causasNaoConclusao", () => {
  beforeEach(() => reset());

  it("compromissosSemanais.insertRaw usa tabela compromissos_semanais", async () => {
    await compromissosSemanaisRepo.insertRaw({ semana: "2026-W01" });
    expect(recorded[0].table).toBe("compromissos_semanais");
    expect(recorded[0].ops[0]).toEqual({
      op: "insert",
      args: [{ semana: "2026-W01" }],
    });
  });

  it("causasNaoConclusao.listChaveLabel usa projeção chave, label", async () => {
    await causasNaoConclusaoRepo.listChaveLabel();
    expect(recorded[0].table).toBe("causas_nao_conclusao");
    expect(recorded[0].ops[0].args[0]).toBe("chave, label");
  });
});
