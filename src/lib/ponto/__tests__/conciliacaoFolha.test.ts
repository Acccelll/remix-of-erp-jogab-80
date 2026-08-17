import { describe, it, expect } from "vitest";
import {
  conciliar,
  dentroDaTolerancia,
  resumirConciliacao,
  valorEsperadoHe,
  type HoleriteDaCompetencia,
  type PontoDaCompetencia,
} from "../conciliacaoFolha";

function ponto(over: Partial<PontoDaCompetencia> = {}): PontoDaCompetencia {
  return {
    chave: "c1",
    colaboradorId: "c1",
    nome: "ANA",
    he50Min: 0,
    he60Min: 0,
    he100Min: 0,
    horasFaltaMin: 0,
    diasFalta: 0,
    ...over,
  };
}

function holerite(over: Partial<HoleriteDaCompetencia> = {}): HoleriteDaCompetencia {
  return {
    chave: "c1",
    colaboradorId: "c1",
    nome: "ANA",
    salarioBase: 2200,
    heValorTotal: 0,
    dsrValor: 0,
    ...over,
  };
}

describe("valorEsperadoHe", () => {
  // Salário 2200 / 220h = R$ 10,00 a hora normal.
  it("aplica o adicional de cada faixa", () => {
    expect(valorEsperadoHe({ he50Min: 60, he60Min: 0, he100Min: 0 }, 2200)).toBeCloseTo(15, 2);
    expect(valorEsperadoHe({ he50Min: 0, he60Min: 60, he100Min: 0 }, 2200)).toBeCloseTo(16, 2);
    expect(valorEsperadoHe({ he50Min: 0, he60Min: 0, he100Min: 60 }, 2200)).toBeCloseTo(20, 2);
  });

  it("soma as faixas e converte minutos corretamente", () => {
    // 30min a 50% (7,50) + 90min a 60% (24,00) = 31,50
    expect(valorEsperadoHe({ he50Min: 30, he60Min: 90, he100Min: 0 }, 2200)).toBeCloseTo(31.5, 2);
  });

  it("devolve zero sem salário base ou sem jornada", () => {
    expect(valorEsperadoHe({ he50Min: 600, he60Min: 0, he100Min: 0 }, 0)).toBe(0);
    expect(valorEsperadoHe({ he50Min: 600, he60Min: 0, he100Min: 0 }, 2200, 0)).toBe(0);
  });
});

describe("dentroDaTolerancia", () => {
  it("exige os dois limites — percentual e absoluto", () => {
    // 2% de 1000 = 20, mas o teto absoluto é R$ 5.
    expect(dentroDaTolerancia(10, 1000)).toBe(false);
    expect(dentroDaTolerancia(4, 1000)).toBe(true);
    // R$ 4 num esperado de 50 é 8% — passa do percentual.
    expect(dentroDaTolerancia(4, 50)).toBe(false);
  });

  it("aceita diferença pequena quando não há valor esperado", () => {
    expect(dentroDaTolerancia(3, 0)).toBe(true);
    expect(dentroDaTolerancia(30, 0)).toBe(false);
  });
});

describe("conciliar", () => {
  it("confere quando o pago bate com o esperado", () => {
    const [l] = conciliar([ponto({ he60Min: 600 })], [holerite({ heValorTotal: 160 })]);
    // 10h a 60% sobre hora de R$10 = R$160
    expect(l.valorEsperado).toBeCloseTo(160, 2);
    expect(l.situacao).toBe("ok");
    expect(l.diferenca).toBeCloseTo(0, 2);
  });

  it("tira o DSR da comparação — ele está dentro de horas_extras_valor", () => {
    // Sem descontar o DSR, os R$ 190 pagos acusariam "pago a maior" indevidamente.
    const [l] = conciliar(
      [ponto({ he60Min: 600 })],
      [holerite({ heValorTotal: 190, dsrValor: 30 })],
    );
    expect(l.valorPago).toBeCloseTo(160, 2);
    expect(l.dsrPago).toBe(30);
    expect(l.situacao).toBe("ok");
  });

  it("acusa pago a maior e pago a menor", () => {
    const [maior] = conciliar([ponto({ he60Min: 600 })], [holerite({ heValorTotal: 260 })]);
    expect(maior.situacao).toBe("pago_a_maior");
    expect(maior.diferenca).toBeCloseTo(100, 2);
    expect(maior.diferencaPct).toBeCloseTo(62.5, 1);

    const [menor] = conciliar([ponto({ he60Min: 600 })], [holerite({ heValorTotal: 60 })]);
    expect(menor.situacao).toBe("pago_a_menor");
    expect(menor.diferenca).toBeCloseTo(-100, 2);
  });

  it("lista quem tem HE apurada e nenhum holerite", () => {
    const [l] = conciliar([ponto({ he50Min: 300 })], []);
    expect(l.situacao).toBe("sem_holerite");
    expect(l.heTotalMin).toBe(300);
    expect(l.diferenca).toBeNull();
  });

  it("lista quem recebeu HE sem nenhuma hora apurada", () => {
    const [l] = conciliar([], [holerite({ heValorTotal: 150 })]);
    expect(l.situacao).toBe("sem_ponto");
    expect(l.valorPago).toBe(150);
  });

  it("não inventa comparação sem salário base", () => {
    const [l] = conciliar(
      [ponto({ he60Min: 600 })],
      [holerite({ salarioBase: 0, heValorTotal: 160 })],
    );
    expect(l.situacao).toBe("sem_salario_base");
    expect(l.valorEsperado).toBeNull();
    expect(l.diferenca).toBeNull();
  });

  it("nunca deixa o pago negativo quando o DSR vem maior que o total", () => {
    const [l] = conciliar([ponto()], [holerite({ heValorTotal: 10, dsrValor: 40 })]);
    expect(l.valorPago).toBe(0);
  });

  it("ordena pela maior divergência em dinheiro", () => {
    const linhas = conciliar(
      [
        ponto({ chave: "c1", nome: "ANA", he60Min: 600 }),
        ponto({ chave: "c2", nome: "BRUNO", he60Min: 600 }),
      ],
      [
        holerite({ chave: "c1", nome: "ANA", heValorTotal: 170 }),
        holerite({ chave: "c2", nome: "BRUNO", heValorTotal: 400 }),
      ],
    );
    expect(linhas.map((l) => l.nome)).toEqual(["BRUNO", "ANA"]);
  });
});

describe("resumirConciliacao", () => {
  it("separa o total pago a maior do pago a menor", () => {
    const linhas = conciliar(
      [
        ponto({ chave: "c1", he60Min: 600 }),
        ponto({ chave: "c2", he60Min: 600 }),
        ponto({ chave: "c3", he60Min: 600 }),
      ],
      [
        holerite({ chave: "c1", heValorTotal: 260 }), // +100
        holerite({ chave: "c2", heValorTotal: 60 }), // -100
        holerite({ chave: "c3", heValorTotal: 160 }), // ok
      ],
    );
    const resumo = resumirConciliacao(linhas);
    expect(resumo).toMatchObject({ colaboradores: 3, divergentes: 2 });
    expect(resumo.totalPagoAMaior).toBeCloseTo(100, 2);
    expect(resumo.totalPagoAMenor).toBeCloseTo(100, 2);
  });

  it("conta as pendências de dado sem contá-las como divergência", () => {
    const linhas = conciliar([ponto({ chave: "c1", he60Min: 60 })], [holerite({ chave: "c2" })]);
    const resumo = resumirConciliacao(linhas);
    expect(resumo).toMatchObject({ divergentes: 0, semHolerite: 1, semPonto: 1 });
  });
});
