import { describe, it, expect } from "vitest";
import {
  pacoteEstaPronto,
  restricoesAbertas,
  restricoesVencidas,
  restricoesPorTipo,
  semaforoPacote,
  type Restricao,
} from "../restricoes";

const hoje = new Date("2024-06-26T12:00:00Z");

describe("restricoes", () => {
  it("pacote pronto sem restrições abertas", () => {
    const rs: Restricao[] = [
      { id: "1", tipo: "material", status: "resolvida" },
      { id: "2", tipo: "projeto", status: "cancelada" },
    ];
    expect(pacoteEstaPronto(rs)).toBe(true);
  });

  it("pacote NÃO pronto se houver aberta", () => {
    const rs: Restricao[] = [{ id: "1", tipo: "material", status: "aberta" }];
    expect(pacoteEstaPronto(rs)).toBe(false);
  });

  it("vencidas considera prazo < hoje e status aberta", () => {
    const rs: Restricao[] = [
      { id: "1", tipo: "material", status: "aberta", prazo: "2024-06-20" },
      { id: "2", tipo: "projeto", status: "aberta", prazo: "2024-06-30" },
      { id: "3", tipo: "clima" as never, status: "resolvida", prazo: "2024-06-10" },
    ];
    const v = restricoesVencidas(rs, hoje);
    expect(v).toHaveLength(1);
    expect(v[0].id).toBe("1");
  });

  it("semaforo vermelho > amarelo > verde", () => {
    expect(semaforoPacote([], hoje)).toBe("verde");
    expect(
      semaforoPacote([{ id: "1", tipo: "material", status: "aberta", prazo: "2024-06-30" }], hoje),
    ).toBe("amarelo");
    expect(
      semaforoPacote([{ id: "1", tipo: "material", status: "aberta", prazo: "2024-06-20" }], hoje),
    ).toBe("vermelho");
  });

  it("restricoesPorTipo conta só abertas", () => {
    const rs: Restricao[] = [
      { id: "1", tipo: "material", status: "aberta" },
      { id: "2", tipo: "material", status: "resolvida" },
      { id: "3", tipo: "projeto", status: "aberta" },
    ];
    const c = restricoesPorTipo(rs);
    expect(c.material).toBe(1);
    expect(c.projeto).toBe(1);
    expect(c.outro).toBe(0);
  });

  it("restricoesAbertas filtra status", () => {
    const rs: Restricao[] = [
      { id: "1", tipo: "material", status: "aberta" },
      { id: "2", tipo: "projeto", status: "resolvida" },
    ];
    expect(restricoesAbertas(rs)).toHaveLength(1);
  });
});
