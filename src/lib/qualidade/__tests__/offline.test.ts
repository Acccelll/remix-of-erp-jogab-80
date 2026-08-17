import { describe, it, expect } from "vitest";
import {
  emptyInspecao,
  inspecaoToMutations,
  reconcilarNcs,
  type InspecaoData,
  type InspecaoRespostaLocal,
} from "../offline";
import { SEGURANCA_FRENTE_SERVICO } from "../modelos";

const ctx = {
  modelo: SEGURANCA_FRENTE_SERVICO,
  createdBy: "00000000-0000-0000-0000-000000000001",
};

function dataBase(): InspecaoData {
  return emptyInspecao({ modeloId: "m1", obraId: "obra1" });
}

describe("inspecaoToMutations", () => {
  it("gera 1 mutação para cabeçalho quando sem respostas/fotos/ncs", () => {
    const ops = inspecaoToMutations(dataBase(), { ...ctx, score: 100 });
    expect(ops).toHaveLength(1);
    expect(ops[0].table).toBe("inspecoes");
    expect(ops[0].payload).toMatchObject({
      obra_id: "obra1",
      status: "rascunho",
      score: 100,
      aprovado: true, // score 100 >= scoreMinimo 100
    });
  });

  it("emite respostas com onConflict natural (inspecao_id,pergunta_id)", () => {
    const d = dataBase();
    const r: InspecaoRespostaLocal = {
      id: "r1",
      perguntaId: "p1",
      perguntaTempId: "epi_todos",
      conformidade: "sim",
    };
    d.respostas[r.id] = r;
    const ops = inspecaoToMutations(d, { ...ctx, score: 100 });
    const respOp = ops.find((o) => o.table === "inspecao_respostas");
    expect(respOp?.onConflict).toBe("inspecao_id,pergunta_id");
    expect(respOp?.payload).toMatchObject({ conformidade: "sim" });
  });

  it("emite NCs ligadas à inspeção e à resposta", () => {
    const d = dataBase();
    d.respostas["r1"] = {
      id: "r1",
      perguntaId: "p1",
      perguntaTempId: "epi_todos",
      conformidade: "nao",
    };
    d.ncs = [
      {
        id: "nc1",
        respostaId: "r1",
        perguntaTempId: "epi_todos",
        titulo: "x",
        severidade: "alta",
        assinatura: "k",
      },
    ];
    const ops = inspecaoToMutations(d, { ...ctx, score: 0 });
    const nc = ops.find((o) => o.table === "nao_conformidades");
    expect(nc?.payload).toMatchObject({
      inspecao_id: d.inspecao_id,
      resposta_id: "r1",
      severidade: "alta",
      status: "aberta",
      created_by: ctx.createdBy,
    });
  });

  it("aprovado=null quando modelo não define scoreMinimo", () => {
    const semMin = { ...SEGURANCA_FRENTE_SERVICO, scoreMinimo: undefined };
    const ops = inspecaoToMutations(dataBase(), { modelo: semMin, createdBy: "u", score: 50 });
    expect(ops[0].payload.aprovado).toBeNull();
  });
});

describe("reconcilarNcs", () => {
  it("cria NC nova para resposta que dispara geraNcSe", () => {
    const respostas: Record<string, InspecaoRespostaLocal> = {
      r1: { id: "r1", perguntaId: "p", perguntaTempId: "epi_todos", conformidade: "nao" },
    };
    const ncs = reconcilarNcs(SEGURANCA_FRENTE_SERVICO, respostas, [], "Torre A");
    expect(ncs).toHaveLength(1);
    expect(ncs[0].perguntaTempId).toBe("epi_todos");
    expect(ncs[0].assinatura).toBe("SEG-001-FRENTE|epi_todos|Torre A");
    expect(ncs[0].severidade).toBe("alta"); // peso 5
  });

  it("preserva o id da NC quando ela já existe (idempotente no upsert)", () => {
    const respostas: Record<string, InspecaoRespostaLocal> = {
      r1: { id: "r1", perguntaId: "p", perguntaTempId: "epi_todos", conformidade: "nao" },
    };
    const ncsAtuais = [
      {
        id: "nc-existente",
        respostaId: "r1",
        perguntaTempId: "epi_todos",
        titulo: "x",
        severidade: "alta" as const,
        assinatura: "k",
      },
    ];
    const ncs = reconcilarNcs(SEGURANCA_FRENTE_SERVICO, respostas, ncsAtuais);
    expect(ncs[0].id).toBe("nc-existente");
  });

  it("não cria NC quando a pergunta-mãe da condicional está oculta", () => {
    const respostas: Record<string, InspecaoRespostaLocal> = {
      r1: { id: "r1", perguntaId: "p", perguntaTempId: "altura", conformidade: "nao" },
      // pta_emitida só aparece quando altura=sim
      r2: { id: "r2", perguntaId: "p", perguntaTempId: "pta_emitida", conformidade: "nao" },
    };
    const ncs = reconcilarNcs(SEGURANCA_FRENTE_SERVICO, respostas, []);
    expect(ncs.find((n) => n.perguntaTempId === "pta_emitida")).toBeUndefined();
  });
});
