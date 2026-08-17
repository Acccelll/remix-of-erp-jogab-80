import { describe, expect, it, vi } from "vitest";
import {
  buildExternalEventsPayload,
  ExternalEventSink,
  type ExternalEventsPayload,
} from "../event-collector";
import type { Severity, StructuredEvent } from "../structured-logger";

const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const ENDPOINT = "https://collector.example/events";

function ev(n: number, severity: Severity = "info"): StructuredEvent {
  return {
    ts: "2026-01-01T00:00:00.000Z",
    severity,
    event: `e-${n}`,
    correlationId: `cid-${n}`,
  };
}

function bodyOf(fetchFn: ReturnType<typeof vi.fn>): ExternalEventsPayload {
  const init = fetchFn.mock.calls.at(-1)?.[1] as RequestInit;
  return JSON.parse(String(init.body)) as ExternalEventsPayload;
}

describe("buildExternalEventsPayload", () => {
  it("gera payload versionado e serializável", () => {
    expect(buildExternalEventsPayload(T0, "manual", [ev(1)], 2)).toEqual({
      schemaVersion: 1,
      sentAt: new Date(T0).toISOString(),
      reason: "manual",
      dropped: 2,
      events: [ev(1)],
    });
  });
});

describe("ExternalEventSink", () => {
  it("aplica amostragem, preservando warn/error fora do ratio", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 200 }));
    const sink = new ExternalEventSink({
      endpoint: ENDPOINT,
      samplingRatio: 0,
      batchSize: 10,
      bufferCapacity: 10,
      fetchFn,
      now: () => T0,
    });

    sink.accept(ev(1, "info"));
    sink.accept(ev(2, "warn"));

    await expect(sink.flush()).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchFn).events.map((e) => e.event)).toEqual(["e-2"]);
  });

  it("envia lote JSON com keepalive e contador de drops", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 200 }));
    const sink = new ExternalEventSink({
      endpoint: ENDPOINT,
      samplingRatio: 1,
      batchSize: 10,
      bufferCapacity: 2,
      fetchFn,
      now: () => T0,
    });

    sink.accept(ev(1));
    sink.accept(ev(2));
    sink.accept(ev(3));

    await expect(sink.flush()).resolves.toBe(true);
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const payload = bodyOf(fetchFn);
    expect(init.keepalive).toBe(true);
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(payload.dropped).toBe(1);
    expect(payload.events.map((e) => e.event)).toEqual(["e-2", "e-3"]);
  });

  it("recoloca eventos em falha e respeita backoff exponencial", async () => {
    let status = 500;
    let now = T0;
    const fetchFn = vi.fn(async () => new Response("", { status }));
    const sink = new ExternalEventSink({
      endpoint: ENDPOINT,
      samplingRatio: 1,
      batchSize: 10,
      bufferCapacity: 10,
      baseBackoffMs: 500,
      maxBackoffMs: 2_000,
      fetchFn,
      now: () => now,
    });

    sink.accept(ev(1));
    await expect(sink.flush()).resolves.toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    now = T0 + 250;
    await expect(sink.flush()).resolves.toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    status = 200;
    now = T0 + 500;
    await expect(sink.flush()).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchFn).events.map((e) => e.event)).toEqual(["e-1"]);
  });

  it("usa sendBeacon no unload e drena o buffer", async () => {
    const sendBeacon = vi.fn(() => true);
    const sink = new ExternalEventSink({
      endpoint: ENDPOINT,
      samplingRatio: 1,
      batchSize: 10,
      bufferCapacity: 10,
      navigatorLike: { sendBeacon },
      now: () => T0,
    });

    sink.accept(ev(1));

    expect(sink.flushBeacon()).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, data] = sendBeacon.mock.calls[0] as unknown as [string, string];
    expect(url).toBe(ENDPOINT);
    const payload = JSON.parse(data) as ExternalEventsPayload;
    expect(payload.reason).toBe("unload");
    expect(payload.events.map((e) => e.event)).toEqual(["e-1"]);
    await expect(sink.flush()).resolves.toBe(true);
  });

  it("ignora evento de fetch do próprio transporte para evitar recursão", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 200 }));
    const sink = new ExternalEventSink({
      endpoint: ENDPOINT,
      samplingRatio: 1,
      batchSize: 10,
      bufferCapacity: 10,
      fetchFn,
      now: () => T0,
    });

    sink.accept({
      ...ev(1, "debug"),
      event: "sb.fetch.ok",
      fields: { url: ENDPOINT, status: 204 },
    });

    await expect(sink.flush()).resolves.toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});