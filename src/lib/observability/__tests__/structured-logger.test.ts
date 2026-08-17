import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetCorrelationForTests,
  newCorrelationId,
  withCorrelation,
  getCorrelationId,
} from "../correlation";
import {
  __resetSinksForTests,
  addSink,
  structured,
  type StructuredEvent,
} from "../structured-logger";

beforeEach(() => {
  __resetCorrelationForTests();
  __resetSinksForTests();
});

describe("correlation", () => {
  it("gera ids únicos com prefixo padrão", () => {
    const a = newCorrelationId();
    const b = newCorrelationId();
    expect(a).not.toBe(b);
    expect(a.startsWith("cor_")).toBe(true);
  });

  it("empilha/desempilha ids em LIFO", () => {
    expect(getCorrelationId()).toBeUndefined();
    withCorrelation("outer", () => {
      expect(getCorrelationId()).toBe("outer");
      withCorrelation("inner", () => {
        expect(getCorrelationId()).toBe("inner");
      });
      expect(getCorrelationId()).toBe("outer");
    });
    expect(getCorrelationId()).toBeUndefined();
  });

  it("desempilha mesmo em caso de exceção", () => {
    expect(() =>
      withCorrelation("x", () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(getCorrelationId()).toBeUndefined();
  });
});

describe("structured logger", () => {
  it("emite evento com ts/severity/event e propaga sink", () => {
    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    structured.info("auth.login.ok", { fields: { userId: "u1" } });

    expect(capturados).toHaveLength(1);
    const [e] = capturados;
    expect(e.severity).toBe("info");
    expect(e.event).toBe("auth.login.ok");
    expect(e.fields).toEqual({ userId: "u1" });
    expect(typeof e.ts).toBe("string");
    expect(new Date(e.ts).toString()).not.toBe("Invalid Date");
  });

  it("herda correlationId do contexto corrente", () => {
    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    withCorrelation("cor_abc", () => {
      structured.warn("job.retry", { fields: { attempt: 2 } });
    });

    expect(capturados[0].correlationId).toBe("cor_abc");
  });

  it("aceita correlationId explícito e sobrepõe o contexto", () => {
    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    withCorrelation("do-contexto", () => {
      structured.error("api.fail", { correlationId: "explicito" });
    });

    expect(capturados[0].correlationId).toBe("explicito");
  });

  it("serializa Error preservando name/message", () => {
    const capturados: StructuredEvent[] = [];
    addSink((e) => capturados.push(e));

    structured.error("boom", { fields: { err: new Error("nope") } });

    expect(capturados[0].fields?.err).toEqual({
      name: "Error",
      message: "nope",
    });
  });

  it("um sink que lança não derruba os demais", () => {
    const bons: StructuredEvent[] = [];
    addSink(() => {
      throw new Error("sink ruim");
    });
    addSink((e) => bons.push(e));

    structured.debug("ok");

    expect(bons).toHaveLength(1);
  });
});
