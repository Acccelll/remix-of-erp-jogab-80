import { describe, expect, it } from "vitest";
import {
  createNC,
  diasAteVencimento,
  estaVencida,
  isFinal,
  transition,
  type NCState,
} from "../nc-workflow";

const NOW = "2026-07-14T12:00:00.000Z";
const PRAZO = "2026-07-20T12:00:00.000Z";

function unwrap<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
}

function atribuir(state: NCState): NCState {
  return unwrap(
    transition(state, {
      type: "atribuir",
      responsavelId: "user-1",
      prazoISO: PRAZO,
      nowISO: NOW,
    }),
  ).state;
}

describe("createNC / transitions", () => {
  it("estado inicial é aberta sem responsável", () => {
    const s = createNC();
    expect(s.status).toBe("aberta");
    expect(s.responsavelId).toBeNull();
    expect(isFinal(s)).toBe(false);
  });

  it("atribuir exige responsavel, prazo válido e prazo no futuro", () => {
    const s = createNC();
    expect(transition(s, { type: "atribuir", responsavelId: " ", prazoISO: PRAZO, nowISO: NOW }).ok).toBe(false);
    expect(transition(s, { type: "atribuir", responsavelId: "u", prazoISO: "xx", nowISO: NOW }).ok).toBe(false);
    expect(
      transition(s, { type: "atribuir", responsavelId: "u", prazoISO: "2026-07-01T00:00:00.000Z", nowISO: NOW }).ok,
    ).toBe(false);
  });

  it("aberta → em_tratativa preserva responsavel e prazo", () => {
    const s = atribuir(createNC());
    expect(s.status).toBe("em_tratativa");
    expect(s.responsavelId).toBe("user-1");
    expect(s.prazoISO).toBe(PRAZO);
  });

  it("solicitar_reinspecao exige tratativa registrada", () => {
    const s = atribuir(createNC());
    expect(transition(s, { type: "solicitar_reinspecao", nowISO: NOW }).ok).toBe(false);
    const r = transition(s, { type: "registrar_tratativa", tratativa: "corrigido", nowISO: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const r2 = transition(r.state, { type: "solicitar_reinspecao", nowISO: NOW });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.state.status).toBe("aguardando_reinspecao");
  });

  it("reinspecao aprovada finaliza; reprovada volta para em_tratativa", () => {
    let s = atribuir(createNC());
    s = (transition(s, { type: "registrar_tratativa", tratativa: "x", nowISO: NOW }) as { ok: true; state: NCState }).state;
    s = (transition(s, { type: "solicitar_reinspecao", nowISO: NOW }) as { ok: true; state: NCState }).state;
    const reprov = transition(s, { type: "reinspecionar", resultado: "reprovada", nowISO: NOW });
    expect(reprov.ok).toBe(true);
    if (reprov.ok) expect(reprov.state.status).toBe("em_tratativa");
    const aprov = transition(s, { type: "reinspecionar", resultado: "aprovada", nowISO: NOW });
    expect(aprov.ok).toBe(true);
    if (aprov.ok) {
      expect(aprov.state.status).toBe("resolvida");
      expect(isFinal(aprov.state)).toBe(true);
      expect(aprov.state.encerradaEmISO).toBe(NOW);
    }
  });

  it("cancelar exige motivo e bloqueia após estado final", () => {
    const s = atribuir(createNC());
    expect(transition(s, { type: "cancelar", motivo: "", nowISO: NOW }).ok).toBe(false);
    const c = transition(s, { type: "cancelar", motivo: "duplicada", nowISO: NOW });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.state.status).toBe("cancelada");
    expect(transition(c.state, { type: "cancelar", motivo: "de novo", nowISO: NOW }).ok).toBe(false);
  });

  it("diasAteVencimento e estaVencida calculam sem I/O", () => {
    const s = atribuir(createNC());
    expect(diasAteVencimento(s, NOW)).toBe(6);
    expect(estaVencida(s, NOW)).toBe(false);
    expect(estaVencida(s, "2026-08-01T00:00:00.000Z")).toBe(true);
  });
});
