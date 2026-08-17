import { describe, it, expect } from "vitest";
import {
  classificarBucketStatus,
  ehBaixaParcial,
  STATUS_BAIXADO,
  STATUS_BAIXADO_PARCIAL,
  STATUS_CANCELADO,
  STATUS_VENCE_HOJE,
  STATUS_VENCIDO,
  STATUS_A_VENCER,
} from "../status-bucket";

const HOJE = "2026-07-15";

describe("classificarBucketStatus", () => {
  it("18 -> cancelado", () => {
    expect(classificarBucketStatus(STATUS_CANCELADO, "2026-08-01", HOJE)).toBe("cancelado");
  });
  it("3 -> pago", () => {
    expect(classificarBucketStatus(STATUS_BAIXADO, "2026-06-01", HOJE)).toBe("pago");
  });
  it("15 (parcial) com venc futuro -> avencer", () => {
    expect(classificarBucketStatus(STATUS_BAIXADO_PARCIAL, "2026-08-01", HOJE)).toBe("avencer");
  });
  it("15 (parcial) com venc hoje -> hoje", () => {
    expect(classificarBucketStatus(STATUS_BAIXADO_PARCIAL, HOJE, HOJE)).toBe("hoje");
  });
  it("15 (parcial) com venc passado -> vencido", () => {
    expect(classificarBucketStatus(STATUS_BAIXADO_PARCIAL, "2026-06-01", HOJE)).toBe("vencido");
  });
  it("40 -> vencido mesmo sem data", () => {
    expect(classificarBucketStatus(STATUS_VENCIDO, null, HOJE)).toBe("vencido");
  });
  it("29 vencendo hoje", () => {
    expect(classificarBucketStatus(STATUS_VENCE_HOJE, HOJE, HOJE)).toBe("hoje");
  });
  it("56 futuro -> avencer", () => {
    expect(classificarBucketStatus(STATUS_A_VENCER, "2026-09-10", HOJE)).toBe("avencer");
  });
  it("56 com data passada -> vencido (código desatualizado)", () => {
    expect(classificarBucketStatus(STATUS_A_VENCER, "2026-06-01", HOJE)).toBe("vencido");
  });
  it("status desconhecido -> outro", () => {
    expect(classificarBucketStatus(99, HOJE, HOJE)).toBe("outro");
  });
  it("null -> outro", () => {
    expect(classificarBucketStatus(null, HOJE, HOJE)).toBe("outro");
  });
});

describe("ehBaixaParcial", () => {
  it("true apenas para 15", () => {
    expect(ehBaixaParcial(STATUS_BAIXADO_PARCIAL)).toBe(true);
    expect(ehBaixaParcial(STATUS_BAIXADO)).toBe(false);
    expect(ehBaixaParcial(null)).toBe(false);
  });
});
