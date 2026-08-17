import { describe, it, expect } from "vitest";
import { chaveLinha, normalizaNome, resolverColaboradores, resolverObras } from "../vinculo";

const COLABORADORES = [
  { id: "c1", nome: "JOSÉ DA SILVA", cpf: "12345678901", matricula: "0001" },
  { id: "c2", nome: "MARIA SOUZA", cpf: "98765432100", matricula: "0002" },
  { id: "c3", nome: "SEM DOCUMENTOS" },
];

const OBRAS = [
  { id: "o1", nome: "COPI", codigo: "01.002.0210" },
  { id: "o2", nome: "MARFRIG", codigo: "01.002.0209" },
];

describe("normalizaNome", () => {
  it("ignora caixa, acento e espaço repetido", () => {
    expect(normalizaNome("  José   DA Silva ")).toBe("jose da silva");
  });
});

describe("resolverColaboradores", () => {
  it("casa pelo CPF antes de tudo", () => {
    const linhas = [{ nome: "J. SILVA", cpf: "12345678901" }];
    expect(resolverColaboradores(linhas, COLABORADORES).get(chaveLinha(linhas[0]))).toBe("c1");
  });

  it("cai para matrícula quando não há CPF", () => {
    const linhas = [{ nome: "DESCONHECIDO", matricula: "0002" }];
    expect(resolverColaboradores(linhas, COLABORADORES).get(chaveLinha(linhas[0]))).toBe("c2");
  });

  it("cai para nome normalizado como último recurso", () => {
    const linhas = [{ nome: "jose da silva" }];
    expect(resolverColaboradores(linhas, COLABORADORES).get(chaveLinha(linhas[0]))).toBe("c1");
  });

  it("ignora pontuação do CPF e da matrícula", () => {
    const linhas = [
      { nome: "X", cpf: "123.456.789-01" },
      { nome: "Y", matricula: "000-2" },
    ];
    const mapa = resolverColaboradores(linhas, COLABORADORES);
    expect(mapa.get(chaveLinha(linhas[0]))).toBe("c1");
    expect(mapa.get(chaveLinha(linhas[1]))).toBe("c2");
  });

  it("deixa sem vínculo quem não casa por nenhum critério", () => {
    const linhas = [{ nome: "FULANO NOVO", cpf: "11111111111" }];
    expect(resolverColaboradores(linhas, COLABORADORES).size).toBe(0);
  });

  it("devolve mapa vazio sem cadastro carregado", () => {
    expect(resolverColaboradores([{ nome: "QUALQUER" }], []).size).toBe(0);
  });
});

describe("resolverObras", () => {
  it("casa o número do departamento com o código da obra", () => {
    const { obraMap } = resolverObras([{ nome: "A", departamento: "210 - COPI" }], OBRAS);
    expect(obraMap.get("210 - COPI")).toBe("o1");
  });

  it("marca centro indireto e não vincula obra", () => {
    const { obraMap, indiretoMap } = resolverObras(
      [{ nome: "A", departamento: "101 - BARRACÃO" }],
      OBRAS,
    );
    expect(indiretoMap.get("101 - BARRACÃO")).toBe(true);
    expect(obraMap.size).toBe(0);
  });

  it("deixa sem obra o departamento cujo código não existe", () => {
    const { obraMap } = resolverObras([{ nome: "A", departamento: "999 - NOVA" }], OBRAS);
    expect(obraMap.size).toBe(0);
  });

  it("override manual tem precedência sobre a heurística", () => {
    const overrides = new Map([["210 - COPI", { obraId: "o2", indireto: false }]]);
    const { obraMap } = resolverObras(
      [{ nome: "A", departamento: "210 - COPI" }],
      OBRAS,
      overrides,
    );
    expect(obraMap.get("210 - COPI")).toBe("o2");
  });

  it("override pode marcar como indireto um departamento que a heurística vincularia", () => {
    const overrides = new Map([["210 - COPI", { obraId: null, indireto: true }]]);
    const { obraMap, indiretoMap } = resolverObras(
      [{ nome: "A", departamento: "210 - COPI" }],
      OBRAS,
      overrides,
    );
    expect(indiretoMap.get("210 - COPI")).toBe(true);
    expect(obraMap.size).toBe(0);
  });

  it("resolve cada departamento uma vez só", () => {
    const { obraMap } = resolverObras(
      [
        { nome: "A", departamento: "210 - COPI" },
        { nome: "B", departamento: "210 - COPI" },
        { nome: "C", departamento: "209 - MARFRIG" },
      ],
      OBRAS,
    );
    expect(obraMap.size).toBe(2);
  });
});
