import { describe, expect, it } from "vitest";
import { EventBuffer } from "../event-buffer";
import type { StructuredEvent } from "../structured-logger";

function ev(n: number): StructuredEvent {
  return {
    ts: "2026-01-01T00:00:00.000Z",
    severity: "info",
    event: `e-${n}`,
  };
}

describe("EventBuffer", () => {
  it("rejeita capacity inválida", () => {
    expect(() => new EventBuffer({ capacity: 0 })).toThrow();
  });

  it("acumula e drena em ordem", () => {
    const b = new EventBuffer({ capacity: 5 });
    b.push(ev(1));
    b.push(ev(2));
    expect(b.size()).toBe(2);
    const out = b.drain();
    expect(out.map((e) => e.event)).toEqual(["e-1", "e-2"]);
    expect(b.size()).toBe(0);
  });

  it("descarta o mais antigo ao estourar capacidade e conta drops", () => {
    const b = new EventBuffer({ capacity: 2 });
    b.push(ev(1));
    b.push(ev(2));
    b.push(ev(3));
    expect(b.droppedCount()).toBe(1);
    expect(b.drain().map((e) => e.event)).toEqual(["e-2", "e-3"]);
    b.resetDropped();
    expect(b.droppedCount()).toBe(0);
  });
});
