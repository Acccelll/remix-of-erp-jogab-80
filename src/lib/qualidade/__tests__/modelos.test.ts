import { describe, it, expect } from "vitest";
import {
  MODELOS_PADRAO,
  FVS_ESTRUTURA,
  SEGURANCA_FRENTE_SERVICO,
  RECEBIMENTO_GENERICO,
  validarModelo,
  perguntaVisivel,
  perguntasVisiveis,
  calcularScore,
  ncsDisparadas,
} from "../modelos";

describe("modelos padrão de inspeção", () => {
  it("todos os modelos passam na validação", () => {
    for (const m of MODELOS_PADRAO) {
      const erros = validarModelo(m);
      expect(erros, `${m.codigo}: ${JSON.stringify(erros)}`).toEqual([]);
    }
  });

  it("códigos únicos", () => {
    const codigos = MODELOS_PADRAO.map((m) => m.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("toda dependência aponta para pergunta declarada antes (sem ciclos)", () => {
    for (const m of MODELOS_PADRAO) {
      const vistas = new Set<string>();
      for (const p of m.perguntas) {
        if (p.dependeDe) expect(vistas.has(p.dependeDe)).toBe(true);
        vistas.add(p.tempId);
      }
    }
  });
});

describe("validarModelo — casos negativos", () => {
  it("detecta dependeDe inexistente", () => {
    const erros = validarModelo({
      codigo: "X",
      nome: "X",
      categoria: "outros",
      setor: "Qualidade",
      descricao: "",
      perguntas: [
        { tempId: "a", texto: "?", tipo: "sim_nao_na", dependeDe: "fantasma", dependeValor: "sim" },
      ],
    });
    expect(erros.some((e) => e.campo === "dependeDe")).toBe(true);
  });

  it("detecta geraNcSe em tipo incompatível", () => {
    const erros = validarModelo({
      codigo: "X",
      nome: "X",
      categoria: "outros",
      setor: "Qualidade",
      descricao: "",
      perguntas: [{ tempId: "a", texto: "?", tipo: "numero", geraNcSe: "nao" }],
    });
    expect(erros.some((e) => e.campo === "geraNcSe")).toBe(true);
  });

  it("detecta tempId duplicado", () => {
    const erros = validarModelo({
      codigo: "X",
      nome: "X",
      categoria: "outros",
      setor: "Qualidade",
      descricao: "",
      perguntas: [
        { tempId: "a", texto: "1", tipo: "texto" },
        { tempId: "a", texto: "2", tipo: "texto" },
      ],
    });
    expect(erros.some((e) => e.campo === "tempId" && e.mensagem === "tempId duplicado")).toBe(true);
  });
});

describe("perguntaVisivel / perguntasVisiveis", () => {
  it("oculta pergunta dependente até a mãe ser respondida", () => {
    const slumpValor = FVS_ESTRUTURA.perguntas.find((p) => p.tempId === "slump_valor")!;
    expect(perguntaVisivel(slumpValor, {})).toBe(false);
    expect(perguntaVisivel(slumpValor, { slump_test: "nao" })).toBe(false);
    expect(perguntaVisivel(slumpValor, { slump_test: "sim" })).toBe(true);
  });

  it("filtra modelo inteiro pelo estado das respostas", () => {
    const semAltura = perguntasVisiveis(SEGURANCA_FRENTE_SERVICO, {
      altura: "nao",
      energia: "nao",
    });
    expect(semAltura.find((p) => p.tempId === "pta_emitida")).toBeUndefined();
    expect(semAltura.find((p) => p.tempId === "loto")).toBeUndefined();

    const comAltura = perguntasVisiveis(SEGURANCA_FRENTE_SERVICO, {
      altura: "sim",
      energia: "nao",
    });
    expect(comAltura.find((p) => p.tempId === "pta_emitida")).toBeDefined();
    expect(comAltura.find((p) => p.tempId === "cinto_ancorado")).toBeDefined();
  });
});

describe("calcularScore", () => {
  it("retorna 100 quando todas as visíveis sim_nao_na estão 'sim'", () => {
    const resp: Record<string, string> = {};
    for (const p of FVS_ESTRUTURA.perguntas) {
      if (p.tipo === "sim_nao_na") resp[p.tempId] = "sim";
    }
    expect(calcularScore(FVS_ESTRUTURA, resp)).toBe(100);
  });

  it("pondera por peso e ignora 'na'", () => {
    // Modelo sintético: 2 perguntas, pesos 1 e 3.
    const modelo = {
      codigo: "X",
      nome: "X",
      categoria: "qualidade" as const,
      setor: "Qualidade" as const,
      descricao: "",
      perguntas: [
        { tempId: "a", texto: "a", tipo: "sim_nao_na" as const, peso: 1, geraNcSe: "nao" },
        { tempId: "b", texto: "b", tipo: "sim_nao_na" as const, peso: 3, geraNcSe: "nao" },
        { tempId: "c", texto: "c", tipo: "sim_nao_na" as const, peso: 5, geraNcSe: "nao" },
      ],
    };

    // a=sim (1/1), b=nao (0/3), c=na (ignorada) → 25%
    expect(calcularScore(modelo, { a: "sim", b: "nao", c: "na" })).toBe(25);
  });

  it("ignora perguntas ocultas pelo condicional", () => {
    // PTA pesa 5; se altura=nao, ela não conta.
    const resp: Record<string, string> = {
      epi_todos: "sim",
      altura: "nao",
      energia: "nao",
      area_isolada: "sim",
      extintor_proximo: "sim",
    };
    expect(calcularScore(SEGURANCA_FRENTE_SERVICO, resp)).toBe(100);
  });
});

describe("ncsDisparadas", () => {
  it("retorna perguntas com geraNcSe satisfeito", () => {
    const ncs = ncsDisparadas(RECEBIMENTO_GENERICO, {
      qtd_correta: "nao",
      material_integro: "sim",
      certificados: "sim",
    });
    expect(ncs.map((n) => n.tempId)).toContain("qtd_correta");
    expect(ncs.map((n) => n.tempId)).not.toContain("material_integro");
  });

  it("ignora NC se a pergunta-mãe está oculta", () => {
    // loto.geraNcSe='nao' mas depende de energia=sim
    const ncs = ncsDisparadas(SEGURANCA_FRENTE_SERVICO, {
      epi_todos: "sim",
      altura: "nao",
      energia: "nao",
      area_isolada: "sim",
      extintor_proximo: "sim",
    });
    expect(ncs.map((n) => n.tempId)).not.toContain("loto");
  });
});
