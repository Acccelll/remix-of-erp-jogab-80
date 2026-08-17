/**
 * TST-002 (lote F) — Testes de integração dos repositories `cards` e
 * `cardsExtra` (várias entidades card_*). Continua o padrão dos lotes B–E.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { cardsRepo } from "@/lib/repositories/cards";
import {
  cardAnexosRepo,
  cardRecursosRepo,
  cardLabelsRepo,
  cardLabelLinksRepo,
  cardComentariosRepo,
  cardAtividadesRepo,
  cardLocalRepo,
  cardCustomFieldValoresRepo,
  cardBoardPosicaoRepo,
  cardGruposNegociacaoRepo,
  cardViewsSalvasRepo,
  cardsExtraRepo,
} from "@/lib/repositories/cardsExtra";

describe("TST-002.f · cardsRepo — contrato", () => {
  beforeEach(() => reset());

  it("getById() seleciona colunas explícitas, filtra id e usa single()", async () => {
    reset({ data: { id: "c1" }, error: null });
    const out = await cardsRepo.getById("c1");
    expect(out).toEqual({ id: "c1" });
    const rec = recorded[0];
    expect(rec.table).toBe("cards");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "single"]);
    expect(String(rec.ops[0].args[0])).toContain("id, numero, tipo, titulo");
    expect(String(rec.ops[0].args[0])).not.toContain("*");
    expect(rec.ops[1].args).toEqual(["id", "c1"]);
  });

  it("getById() propaga erro via unwrap", async () => {
    reset({ data: null, error: new Error("rls") });
    await expect(cardsRepo.getById("c1")).rejects.toThrow("rls");
  });

  it("update() aplica patch e filtra id, propaga erro", async () => {
    reset({ data: null, error: null });
    await cardsRepo.update("c1", { titulo: "x" } as any);
    const rec = recorded[0];
    expect(rec.table).toBe("cards");
    expect(rec.ops.map((o) => o.op)).toEqual(["update", "eq"]);
    expect(rec.ops[0].args[0]).toEqual({ titulo: "x" });
    expect(rec.ops[1].args).toEqual(["id", "c1"]);

    reset({ data: null, error: new Error("boom") });
    await expect(cardsRepo.update("c1", { titulo: "y" } as any)).rejects.toThrow("boom");
  });
});

describe("TST-002.f · cardAnexosRepo — contrato", () => {
  beforeEach(() => reset());

  it("insert/remove/removeByCard usam a tabela correta", async () => {
    await cardAnexosRepo.insert({ card_id: "c1", url: "u" });
    expect(recorded[0].table).toBe("card_anexos");
    expect(recorded[0].ops[0].op).toBe("insert");

    reset();
    await cardAnexosRepo.remove("a1");
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(recorded[0].ops[1].args).toEqual(["id", "a1"]);

    reset();
    await cardAnexosRepo.removeByCard("c1");
    expect(recorded[0].ops[1].args).toEqual(["card_id", "c1"]);
  });

  it("insertMany() faz short-circuit em array vazio", async () => {
    const out = await cardAnexosRepo.insertMany([]);
    expect(out).toEqual({ data: null, error: null });
    expect(recorded.length).toBe(0);
  });

  it("insertMany() insere quando há linhas", async () => {
    await cardAnexosRepo.insertMany([{ card_id: "c1" }]);
    expect(recorded[0].table).toBe("card_anexos");
    expect(recorded[0].ops[0].op).toBe("insert");
  });
});

describe("TST-002.f · cardRecursosRepo — contrato", () => {
  beforeEach(() => reset());

  it("getByCard() usa colunas explícitas, filtra card_id e maybeSingle", async () => {
    await cardRecursosRepo.getByCard("c1");
    const rec = recorded[0];
    expect(rec.table).toBe("card_recursos");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "maybeSingle"]);
    expect(String(rec.ops[0].args[0])).toContain("tipo_recurso");
    expect(rec.ops[1].args).toEqual(["card_id", "c1"]);
  });

  it("insert() chama insert na tabela", async () => {
    await cardRecursosRepo.insert({ card_id: "c1" });
    expect(recorded[0].ops[0].op).toBe("insert");
  });
});

describe("TST-002.f · card_labels + links — contrato", () => {
  beforeEach(() => reset());

  it("cardLabelsRepo.listResumo() seleciona id,nome,cor e ordena por nome", async () => {
    reset({ data: [{ id: "l1" }], error: null });
    const out = await cardLabelsRepo.listResumo();
    expect(out).toEqual([{ id: "l1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("card_labels");
    expect(rec.ops[0].args[0]).toBe("id, nome, cor");
    expect(rec.ops[1].args[0]).toBe("nome");
  });

  it("cardLabelLinksRepo.insertMany() short-circuit em vazio", async () => {
    const out = await cardLabelLinksRepo.insertMany([]);
    expect(out).toEqual({ data: null, error: null });
    expect(recorded.length).toBe(0);
  });

  it("cardLabelLinksRepo.removeByCard() filtra card_id", async () => {
    await cardLabelLinksRepo.removeByCard("c1");
    expect(recorded[0].table).toBe("card_label_links");
    expect(recorded[0].ops[1].args).toEqual(["card_id", "c1"]);
  });
});

describe("TST-002.f · comentarios/atividades — contrato", () => {
  beforeEach(() => reset());

  it("cardComentariosRepo.insertMany() short-circuit e insert normal", async () => {
    expect(await cardComentariosRepo.insertMany([])).toEqual({ data: null, error: null });
    expect(recorded.length).toBe(0);
    await cardComentariosRepo.insert({ card_id: "c1", texto: "t" });
    expect(recorded[0].table).toBe("card_comentarios");
  });

  it("cardAtividadesRepo.insertMany() short-circuit e insert normal", async () => {
    expect(await cardAtividadesRepo.insertMany([])).toEqual({ data: null, error: null });
    expect(recorded.length).toBe(0);
    await cardAtividadesRepo.insert({ card_id: "c1", tipo: "x" });
    expect(recorded[0].table).toBe("card_atividades");
  });
});

describe("TST-002.f · cardLocal + customFieldValores — contrato", () => {
  beforeEach(() => reset());

  it("cardLocalRepo.upsertByCard() usa onConflict=card_id", async () => {
    await cardLocalRepo.upsertByCard({ card_id: "c1", lat: 1 });
    const rec = recorded[0];
    expect(rec.table).toBe("card_local");
    expect(rec.ops[0].op).toBe("upsert");
    expect(rec.ops[0].args[1]).toEqual({ onConflict: "card_id" });
  });

  it("cardLocalRepo.removeByCard() filtra card_id", async () => {
    await cardLocalRepo.removeByCard("c1");
    expect(recorded[0].ops[1].args).toEqual(["card_id", "c1"]);
  });

  it("cardCustomFieldValoresRepo.removeByCard() filtra card_id", async () => {
    await cardCustomFieldValoresRepo.removeByCard("c1");
    expect(recorded[0].table).toBe("card_custom_field_valores");
    expect(recorded[0].ops[1].args).toEqual(["card_id", "c1"]);
  });
});

describe("TST-002.f · cardBoardPosicao + grupos + views — contrato", () => {
  beforeEach(() => reset());

  it("cardBoardPosicaoRepo.upsertMany() propaga onConflict recebido", async () => {
    await cardBoardPosicaoRepo.upsertMany([{ card_id: "c1" }], "card_id,board_id");
    const rec = recorded[0];
    expect(rec.table).toBe("card_board_posicao");
    expect(rec.ops[0].op).toBe("upsert");
    expect(rec.ops[0].args[1]).toEqual({ onConflict: "card_id,board_id" });
  });

  it("cardGruposNegociacaoRepo.listResumo() seleciona id,rotulo", async () => {
    await cardGruposNegociacaoRepo.listResumo();
    expect(recorded[0].table).toBe("card_grupos_negociacao");
    expect(recorded[0].ops[0].args[0]).toBe("id,rotulo");
  });

  it("cardViewsSalvasRepo.remove() filtra id", async () => {
    await cardViewsSalvasRepo.remove("v1");
    expect(recorded[0].ops.map((o) => o.op)).toEqual(["delete", "eq"]);
    expect(recorded[0].ops[1].args).toEqual(["id", "v1"]);
  });
});

describe("TST-002.f · cardsExtraRepo — contrato", () => {
  beforeEach(() => reset());

  it("getFull() usa colunas completas e single()", async () => {
    await cardsExtraRepo.getFull("c1");
    const rec = recorded[0];
    expect(rec.table).toBe("cards");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "single"]);
    expect(String(rec.ops[0].args[0])).toContain("id, numero, tipo, titulo");
    expect(String(rec.ops[0].args[0])).not.toContain("*");
    expect(rec.ops[1].args).toEqual(["id", "c1"]);
  });

  it("setStatus() aplica update status e filtra id", async () => {
    await cardsExtraRepo.setStatus("c1", "arquivado");
    const rec = recorded[0];
    expect(rec.ops[0].op).toBe("update");
    expect(rec.ops[0].args[0]).toEqual({ status: "arquivado" });
    expect(rec.ops[1].args).toEqual(["id", "c1"]);
  });
});
