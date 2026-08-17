import { describe, expect, it } from "vitest";
import {
  calcularStatusGlobalManufaturado,
  opcoesStatus,
  proximosStatusCompras,
  proximosStatusProducao,
  proximosStatusProducaoComDependencia,
  proximosStatusSimples,
} from "../status-card";

describe("fluxos lineares", () => {
  it("simples: identificado → em_cotacao", () => {
    expect(proximosStatusSimples("identificado")).toEqual(["identificado", "em_cotacao"]);
  });
  it("simples: meio do fluxo permite voltar 1 e avançar 1", () => {
    expect(proximosStatusSimples("pedido_emitido")).toEqual([
      "em_cotacao",
      "pedido_emitido",
      "aguardando_entrega",
    ]);
  });
  it("simples: final do fluxo não avança", () => {
    expect(proximosStatusSimples("concluido")).toEqual(["entregue", "concluido"]);
  });
  it("compras: pedido_emitido → materia_entregue", () => {
    expect(proximosStatusCompras("pedido_emitido")).toEqual([
      "em_cotacao",
      "pedido_emitido",
      "materia_entregue",
    ]);
  });
  it("produção: em_fabricacao → produzido", () => {
    expect(proximosStatusProducao("em_fabricacao")).toEqual([
      "aguardando_material",
      "em_fabricacao",
      "produzido",
    ]);
  });
});

describe("status global manufaturado", () => {
  it("ambos no início = identificado", () => {
    expect(calcularStatusGlobalManufaturado("identificado", "aguardando_material")).toBe(
      "identificado",
    );
  });
  it("compras terminou + produção produziu = aguardando_entrega", () => {
    expect(calcularStatusGlobalManufaturado("materia_entregue", "produzido")).toBe(
      "aguardando_entrega",
    );
  });
  it("ambos os trilhos finalizados = concluido", () => {
    expect(calcularStatusGlobalManufaturado("materia_entregue", "entregue_obra")).toBe("concluido");
  });
  it("só compras terminou (produção ainda aguarda) NÃO conclui", () => {
    expect(calcularStatusGlobalManufaturado("materia_entregue", "aguardando_material")).not.toBe(
      "concluido",
    );
  });
  it("só produção terminou (compras ainda em cotação) NÃO conclui", () => {
    // cenário improvável mas o algoritmo precisa ser robusto
    expect(calcularStatusGlobalManufaturado("em_cotacao", "entregue_obra")).not.toBe("concluido");
  });
});

describe("opcoesStatus", () => {
  it("manufaturado não permite editar status global na UI", () => {
    expect(opcoesStatus("manufaturado", "pedido_emitido")).toEqual(["pedido_emitido"]);
  });
  it("material_pronto segue fluxo simples", () => {
    expect(opcoesStatus("material_pronto", "em_cotacao")).toEqual([
      "identificado",
      "em_cotacao",
      "pedido_emitido",
    ]);
  });
});

describe("proximosStatusProducaoComDependencia", () => {
  it("bloqueia avanço enquanto Compras não entregou matéria", () => {
    expect(proximosStatusProducaoComDependencia("aguardando_material", "em_cotacao")).toEqual([
      "aguardando_material",
    ]);
    expect(proximosStatusProducaoComDependencia("aguardando_material", "pedido_emitido")).toEqual([
      "aguardando_material",
    ]);
  });
  it("permite voltar uma casa mesmo travado", () => {
    expect(proximosStatusProducaoComDependencia("em_fabricacao", "pedido_emitido")).toEqual([
      "aguardando_material",
      "em_fabricacao",
    ]);
  });
  it("libera avanço normal após materia_entregue", () => {
    expect(proximosStatusProducaoComDependencia("aguardando_material", "materia_entregue")).toEqual(
      ["aguardando_material", "em_fabricacao"],
    );
    expect(proximosStatusProducaoComDependencia("em_fabricacao", "materia_entregue")).toEqual([
      "aguardando_material",
      "em_fabricacao",
      "produzido",
    ]);
  });
});
