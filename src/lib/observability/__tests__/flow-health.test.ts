import { describe, it, expect, beforeEach } from "vitest";
import { FlowHealthRegistry } from "../flow-health";

let reg: FlowHealthRegistry;
const T0 = 1_700_000_000_000;

beforeEach(() => {
  reg = new FlowHealthRegistry();
  reg.register({ id: "totvs.import", label: "Importação TOTVS", failThreshold: 3, staleAfterMs: 60_000 });
  reg.register({ id: "obra.sync", label: "Sync de Obra" });
});

describe("FlowHealthRegistry", () => {
  it("estado inicial é unknown", () => {
    const snap = reg.snapshot(T0);
    expect(snap.every((s) => s.status === "unknown")).toBe(true);
    expect(reg.overallHealth(T0)).toBe("unknown");
  });

  it("ok move para healthy e zera falhas consecutivas", () => {
    reg.noteFail("totvs.import", T0);
    reg.noteOk("totvs.import", T0 + 1000);
    const s = reg.snapshot(T0 + 1000).find((x) => x.id === "totvs.import")!;
    expect(s.status).toBe("healthy");
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastOkAt).toBe(T0 + 1000);
  });

  it("falhas < threshold ficam degraded; >= threshold viram down", () => {
    reg.noteFail("totvs.import", T0, "timeout");
    let s = reg.snapshot(T0).find((x) => x.id === "totvs.import")!;
    expect(s.status).toBe("degraded");
    reg.noteFail("totvs.import", T0 + 1);
    reg.noteFail("totvs.import", T0 + 2);
    s = reg.snapshot(T0 + 2).find((x) => x.id === "totvs.import")!;
    expect(s.status).toBe("down");
    expect(s.consecutiveFailures).toBe(3);
    expect(s.lastError).toBeUndefined(); // último não teve mensagem
  });

  it("fluxo stale (sem OK dentro da janela) vira down", () => {
    reg.noteOk("totvs.import", T0);
    const s = reg
      .snapshot(T0 + 60_001)
      .find((x) => x.id === "totvs.import")!;
    expect(s.status).toBe("down");
  });

  it("overall = down se qualquer fluxo down", () => {
    reg.noteOk("obra.sync", T0);
    reg.noteFail("totvs.import", T0);
    reg.noteFail("totvs.import", T0);
    reg.noteFail("totvs.import", T0);
    expect(reg.overallHealth(T0)).toBe("down");
  });

  it("overall = degraded quando há healthy + unknown", () => {
    reg.noteOk("obra.sync", T0);
    // totvs.import segue unknown
    expect(reg.overallHealth(T0)).toBe("degraded");
  });

  it("overall = healthy só quando todos healthy", () => {
    reg.noteOk("obra.sync", T0);
    reg.noteOk("totvs.import", T0);
    expect(reg.overallHealth(T0)).toBe("healthy");
  });

  it("noteOk/noteFail em id não registrado é no-op", () => {
    reg.noteFail("nao.existe", T0);
    reg.noteOk("nao.existe", T0);
    expect(reg.snapshot(T0).some((s) => s.id === "nao.existe")).toBe(false);
  });

  it("reset volta tudo a unknown mantendo definições", () => {
    reg.noteOk("obra.sync", T0);
    reg.reset();
    const snap = reg.snapshot(T0);
    expect(snap).toHaveLength(2);
    expect(snap.every((s) => s.status === "unknown")).toBe(true);
  });
});
