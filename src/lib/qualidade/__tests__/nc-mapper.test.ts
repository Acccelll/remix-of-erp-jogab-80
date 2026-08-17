import { describe, expect, it } from "vitest";
import { createNC, transition, type NCEvent, type NCState } from "../nc-workflow";
import { diffRow, fromRow, toRow, type NCRow } from "../nc-mapper";

const NOW = "2026-07-14T12:00:00.000Z";
const PRAZO = "2026-07-20T12:00:00.000Z";

function apply(state: NCState, event: NCEvent): NCState {
  const r = transition(state, event);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.state;
}

function progress(): NCState {
  let s = apply(createNC(), { type: "atribuir", responsavelId: "u1", prazoISO: PRAZO, nowISO: NOW });
  s = apply(s, { type: "registrar_tratativa", tratativa: "corrigido", nowISO: NOW });
  s = apply(s, { type: "solicitar_reinspecao", nowISO: NOW });
  return s;
}

describe("nc-mapper", () => {
  it("aguardando_reinspecao é persistido como em_tratativa + flag", () => {
    const row = toRow(progress());
    expect(row.status).toBe("em_tratativa");
    expect(row.aguardando_reinspecao).toBe(true);
    expect(row.tratativa).toBe("corrigido");
    expect(row.responsavel_id).toBe("u1");
  });

  it("fromRow reidrata para aguardando_reinspecao quando flag ativa", () => {
    const row: NCRow = {
      status: "em_tratativa",
      responsavel_id: "u1",
      prazo: PRAZO,
      tratativa: "corrigido",
      reinspecao_resultado: null,
      reinspecionada_em: null,
      encerrada_em: null,
      aguardando_reinspecao: true,
    };
    expect(fromRow(row).status).toBe("aguardando_reinspecao");
  });

  it("linhas legadas (sem flag) mantêm em_tratativa", () => {
    expect(fromRow({ status: "em_tratativa" }).status).toBe("em_tratativa");
    expect(fromRow({}).status).toBe("aberta");
  });

  it("roundtrip toRow → fromRow preserva o estado", () => {
    const s = progress();
    expect(fromRow(toRow(s))).toEqual(s);
  });

  it("diffRow devolve apenas colunas alteradas", () => {
    const before = createNC();
    const after = progress();
    const patch = diffRow(before, after);
    expect(patch).toEqual({
      status: "em_tratativa",
      responsavel_id: "u1",
      prazo: PRAZO,
      tratativa: "corrigido",
      aguardando_reinspecao: true,
    });
    expect(diffRow(after, after)).toEqual({});
  });
});
