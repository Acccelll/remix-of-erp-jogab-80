import { describe, it, expect } from "vitest";
import { isPermissionError } from "@/components/common/QueryState";

describe("isPermissionError", () => {
  it("detecta código 42501", () => {
    expect(isPermissionError({ code: "42501", message: "permission denied for table obras" })).toBe(
      true,
    );
  });
  it("detecta mensagem de RLS", () => {
    expect(isPermissionError(new Error("new row violates row-level security policy"))).toBe(true);
  });
  it("detecta status 403", () => {
    expect(isPermissionError({ status: 403, message: "Forbidden" })).toBe(true);
  });
  it("ignora erros comuns", () => {
    expect(isPermissionError(new Error("network timeout"))).toBe(false);
    expect(isPermissionError(null)).toBe(false);
  });
});
