/**
 * TST-002 (lote G) — Testes de integração dos contratos de notas fiscais
 * (`financeiro-totvs/queries`) e pedidos/compras (`suprimentosRepo`).
 *
 * Observação: no código atual não há exports chamados `notasFiscaisRepo` ou
 * `pedidosComprasRepo`; este lote fixa as superfícies reais equivalentes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { recorded, reset } from "./_duplo-supabase";

vi.mock("@/integrations/supabase/client", async () => {
  const { supabaseFalso } = await import("./_duplo-supabase");
  return { supabase: supabaseFalso };
});

import { fetchNotasFiscais, fetchRecebimentos } from "@/lib/financeiro-totvs/queries";
import { suprimentosRepo } from "@/lib/repositories/suprimentos";

describe("TST-002.g · notas fiscais/recebimentos — contrato de query", () => {
  beforeEach(() => reset());

  it("fetchNotasFiscais() seleciona colunas explícitas, filtra obra_id e ordena emissão desc", async () => {
    reset({ data: [{ id: "nf1" }], error: null });
    const out = await fetchNotasFiscais("o1");

    expect(out).toEqual([{ id: "nf1" }]);
    const rec = recorded[0];
    expect(rec.table).toBe("notas_fiscais");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(rec.ops[0].args[0]).toBe("id, numero, competencia, data_emissao, valor, valor_liquido, status");
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args).toEqual(["data_emissao", { ascending: false }]);
  });

  it("fetchNotasFiscais() devolve [] quando data é null", async () => {
    reset({ data: null, error: null });
    expect(await fetchNotasFiscais("o1")).toEqual([]);
  });

  it("fetchNotasFiscais() propaga erro do backend", async () => {
    reset({ data: null, error: new Error("nfs denied") });
    await expect(fetchNotasFiscais("o1")).rejects.toThrow("nfs denied");
  });

  it("fetchRecebimentos() seleciona colunas explícitas, filtra obra_id e ordena previsão", async () => {
    reset({ data: [{ id: "r1" }], error: null });
    expect(await fetchRecebimentos("o1")).toEqual([{ id: "r1" }]);

    const rec = recorded[0];
    expect(rec.table).toBe("recebimentos");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "order"]);
    expect(rec.ops[0].args[0]).toBe(
      "id, data_prevista, data_recebimento, valor_previsto, valor_recebido, status, nota_fiscal_id",
    );
    expect(rec.ops[1].args).toEqual(["obra_id", "o1"]);
    expect(rec.ops[2].args[0]).toBe("data_prevista");
  });
});

describe("TST-002.g · suprimentosRepo — OCs/recebimentos", () => {
  beforeEach(() => reset());

  it("listOcs() consulta ordens_compra com colunas padrão e ordena emissão desc", async () => {
    reset({ data: [{ id: "oc1" }], error: null });
    expect(await suprimentosRepo.listOcs()).toEqual([{ id: "oc1" }]);

    const rec = recorded[0];
    expect(rec.table).toBe("ordens_compra");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order", "limit"]);
    expect(rec.ops[0].args[0]).toBe("id, numero, obra_id, fornecedor_id, status, valor_total, data_emissao");
    expect(rec.ops[1].args).toEqual(["data_emissao", { ascending: false }]);
  });

  it("listOcs() propaga erro via unwrap", async () => {
    reset({ data: null, error: new Error("oc denied") });
    await expect(suprimentosRepo.listOcs()).rejects.toThrow("oc denied");
  });

  it("listRecebimentos() consulta recebimentos e ordena data_recebimento desc", async () => {
    reset({ data: [{ id: "r1" }], error: null });
    expect(await suprimentosRepo.listRecebimentos()).toEqual([{ id: "r1" }]);

    const rec = recorded[0];
    expect(rec.table).toBe("recebimentos");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "order", "limit"]);
    expect(rec.ops[0].args[0]).toBe("id, oc_id, data_recebimento, status, nota_fiscal");
    expect(rec.ops[1].args).toEqual(["data_recebimento", { ascending: false }]);
  });

  it("ocById() usa select explícito, eq(id) e single()", async () => {
    reset({ data: { id: "oc1" }, error: null });
    expect(await suprimentosRepo.ocById("oc1")).toEqual({ id: "oc1" });

    const rec = recorded[0];
    expect(rec.table).toBe("ordens_compra");
    expect(rec.ops.map((o) => o.op)).toEqual(["select", "eq", "single"]);
    expect(String(rec.ops[0].args[0])).toContain("status_aprovacao");
    expect(String(rec.ops[0].args[0])).not.toContain("*");
    expect(rec.ops[1].args).toEqual(["id", "oc1"]);
  });
});

describe("TST-002.g · suprimentosRepo — cotações/propostas", () => {
  beforeEach(() => reset());

  it("listCotacoes()/createCotacao()/fecharCotacao() usam tabelas e chaves corretas", async () => {
    await suprimentosRepo.listCotacoes();
    await suprimentosRepo.createCotacao({ requisicao_id: "req1" });
    await suprimentosRepo.fecharCotacao("cot1");

    expect(recorded.map((r) => r.table)).toEqual(["cotacoes", "cotacoes", "cotacoes"]);
    expect(recorded[0].ops).toEqual([{ op: "select", args: ["id,requisicao_id,status"] }]);
    expect(recorded[1].ops).toEqual([{ op: "insert", args: [{ requisicao_id: "req1" }] }]);
    expect(recorded[2].ops).toEqual([
      { op: "update", args: [{ status: "fechada" }] },
      { op: "eq", args: ["id", "cot1"] },
    ]);
  });

  it("setPropostaEscolhida() limpa escolhida por cotação e marca proposta por id", async () => {
    await suprimentosRepo.setPropostaEscolhida("cot1", "prop1");

    expect(recorded.map((r) => r.table)).toEqual(["cotacao_propostas", "cotacao_propostas"]);
    expect(recorded[0].ops).toEqual([
      { op: "update", args: [{ escolhida: false }] },
      { op: "eq", args: ["cotacao_id", "cot1"] },
    ]);
    expect(recorded[1].ops).toEqual([
      { op: "update", args: [{ escolhida: true }] },
      { op: "eq", args: ["id", "prop1"] },
    ]);
  });

  it("setPropostaEscolhida() interrompe quando a limpeza inicial falha", async () => {
    reset({ data: null, error: new Error("proposal denied") });
    await expect(suprimentosRepo.setPropostaEscolhida("cot1", "prop1")).rejects.toThrow("proposal denied");
    expect(recorded).toHaveLength(1);
  });

  it("createProposta()/deleteProposta()/listPropostas() mantêm contrato de tabela", async () => {
    await suprimentosRepo.createProposta({ cotacao_id: "cot1", preco_unitario: 10 });
    await suprimentosRepo.deleteProposta("prop1");
    await suprimentosRepo.listPropostas();

    expect(recorded.map((r) => r.table)).toEqual([
      "cotacao_propostas",
      "cotacao_propostas",
      "cotacao_propostas",
    ]);
    expect(recorded[0].ops[0]).toEqual({ op: "insert", args: [{ cotacao_id: "cot1", preco_unitario: 10 }] });
    expect(recorded[1].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "prop1"] },
    ]);
    expect(recorded[2].ops[0].args[0]).toBe("id,cotacao_id,fornecedor_id,preco_unitario,escolhida");
  });
});

describe("TST-002.g · suprimentosRepo — itens, composições e alçadas", () => {
  beforeEach(() => reset());

  it("createOcItem()/deleteOcItem() escrevem em ordem_compra_itens", async () => {
    await suprimentosRepo.createOcItem({ ordem_compra_id: "oc1" });
    await suprimentosRepo.deleteOcItem("item1");

    expect(recorded.map((r) => r.table)).toEqual(["ordem_compra_itens", "ordem_compra_itens"]);
    expect(recorded[0].ops).toEqual([{ op: "insert", args: [{ ordem_compra_id: "oc1" }] }]);
    expect(recorded[1].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["id", "item1"] },
    ]);
  });

  it("listOrcamentoItens()/createOrcamentoItem()/deleteOrcamentoItem() usam orcamento_itens", async () => {
    await suprimentosRepo.listOrcamentoItens();
    await suprimentosRepo.createOrcamentoItem({ descricao: "Concreto" });
    await suprimentosRepo.deleteOrcamentoItem("orc1");

    expect(recorded.map((r) => r.table)).toEqual(["orcamento_itens", "orcamento_itens", "orcamento_itens"]);
    expect(recorded[0].ops[0].args[0]).toBe("id,descricao,unidade");
    expect(recorded[1].ops[0]).toEqual({ op: "insert", args: [{ descricao: "Concreto" }] });
    expect(recorded[2].ops[1].args).toEqual(["id", "orc1"]);
  });

  it("listComposicoesAtivas() filtra ativo=true", async () => {
    await suprimentosRepo.listComposicoesAtivas();
    const rec = recorded[0];
    expect(rec.table).toBe("composicoes");
    expect(rec.ops).toEqual([
      { op: "select", args: ["id,descricao,unidade,ativo"] },
      { op: "eq", args: ["ativo", true] },
    ]);
  });

  it("listComposicoesTodas() ordena por descricao asc", async () => {
    await suprimentosRepo.listComposicoesTodas();
    expect(recorded[0].table).toBe("composicoes");
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id,descricao,unidade,ativo"] },
      { op: "order", args: ["descricao", { ascending: true }] },
    ]);
  });

  it("createComposicaoReturningId() insere, seleciona id e exige single()", async () => {
    reset({ data: { id: "comp1" }, error: null });
    await expect(suprimentosRepo.createComposicaoReturningId({ descricao: "Argamassa" })).resolves.toBe("comp1");

    const rec = recorded[0];
    expect(rec.table).toBe("composicoes");
    expect(rec.ops).toEqual([
      { op: "insert", args: [{ descricao: "Argamassa" }] },
      { op: "select", args: ["id"] },
      { op: "single", args: [] },
    ]);
  });

  it("deleteComposicaoItensByComposicao()/updateComposicao()/toggleComposicaoAtiva() usam chaves corretas", async () => {
    await suprimentosRepo.deleteComposicaoItensByComposicao("comp1");
    await suprimentosRepo.updateComposicao("comp1", { descricao: "Nova" });
    await suprimentosRepo.toggleComposicaoAtiva("comp1", false);

    expect(recorded.map((r) => r.table)).toEqual(["composicao_itens", "composicoes", "composicoes"]);
    expect(recorded[0].ops).toEqual([
      { op: "delete", args: [] },
      { op: "eq", args: ["composicao_id", "comp1"] },
    ]);
    expect(recorded[1].ops).toEqual([
      { op: "update", args: [{ descricao: "Nova" }] },
      { op: "eq", args: ["id", "comp1"] },
    ]);
    expect(recorded[2].ops).toEqual([
      { op: "update", args: [{ ativo: false }] },
      { op: "eq", args: ["id", "comp1"] },
    ]);
  });

  it("listComposicaoItens()/insertComposicaoItens()/listEstoqueSaldos() mantêm projeções mínimas", async () => {
    await suprimentosRepo.listComposicaoItens();
    await suprimentosRepo.insertComposicaoItens([{ composicao_id: "comp1", insumo_id: "i1" }]);
    await suprimentosRepo.listEstoqueSaldos();

    expect(recorded.map((r) => r.table)).toEqual(["composicao_itens", "composicao_itens", "estoque_saldos"]);
    expect(recorded[0].ops[0].args[0]).toBe("composicao_id,insumo_id,coeficiente");
    expect(recorded[1].ops[0]).toEqual({ op: "insert", args: [[{ composicao_id: "comp1", insumo_id: "i1" }]] });
    expect(recorded[2].ops[0].args[0]).toBe("id,local,insumo_id,saldo,minimo");
  });

  it("listAlcadas() usa projeção explícita e dupla ordenação", async () => {
    await suprimentosRepo.listAlcadas();

    const rec = recorded[0];
    expect(rec.table).toBe("alcadas_aprovacao");
    expect(rec.ops).toEqual([
      { op: "select", args: ["id, valor_min, valor_max, papel_aprovador, ordem, created_at, updated_at"] },
      { op: "order", args: ["valor_min", { ascending: true }] },
      { op: "order", args: ["ordem", { ascending: true }] },
    ]);
  });
});

describe("TST-002.g · suprimentosRepo — grupos de negociação", () => {
  beforeEach(() => reset());

  it("list/create/rename/delete grupos usam card_grupos_negociacao", async () => {
    await suprimentosRepo.listGruposNegociacao();
    await suprimentosRepo.createGrupoNegociacao("Prioritário");
    await suprimentosRepo.renameGrupoNegociacao("g1", "Normal");
    await suprimentosRepo.deleteGrupoNegociacao("g1");

    expect(recorded.map((r) => r.table)).toEqual([
      "card_grupos_negociacao",
      "card_grupos_negociacao",
      "card_grupos_negociacao",
      "card_grupos_negociacao",
    ]);
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["id,rotulo"] },
      { op: "order", args: ["rotulo"] },
    ]);
    expect(recorded[1].ops[0]).toEqual({ op: "insert", args: [{ rotulo: "Prioritário" }] });
    expect(recorded[2].ops).toEqual([
      { op: "update", args: [{ rotulo: "Normal" }] },
      { op: "eq", args: ["id", "g1"] },
    ]);
    expect(recorded[3].ops[1].args).toEqual(["id", "g1"]);
  });

  it("listCardsGrupoNegociacao() consulta cards não arquivados", async () => {
    await suprimentosRepo.listCardsGrupoNegociacao();

    expect(recorded[0].table).toBe("cards");
    expect(recorded[0].ops).toEqual([
      { op: "select", args: ["grupo_negociacao_id"] },
      { op: "eq", args: ["arquivado", false] },
    ]);
  });
});