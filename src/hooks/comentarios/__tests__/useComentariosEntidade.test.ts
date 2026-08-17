import { describe, it, expect } from "vitest";
import { contarPorEntidade } from "@/hooks/comentarios/useComentariosEntidade";
import type { ComentarioEntidade } from "@/types";

const mk = (entidadeId: string, id: string): ComentarioEntidade => ({
  id,
  entidadeId,
  texto: "x",
  autor: "a",
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
});

describe("contarPorEntidade", () => {
  it("retorna mapa vazio para lista vazia", () => {
    expect(contarPorEntidade([]).size).toBe(0);
  });

  it("conta comentários por entidade", () => {
    const map = contarPorEntidade([mk("1", "a"), mk("1", "b"), mk("2", "c")]);
    expect(map.get("1")).toBe(2);
    expect(map.get("2")).toBe(1);
  });

  it("entidade sem comentários fica ausente (get => undefined)", () => {
    const map = contarPorEntidade([mk("1", "a")]);
    expect(map.get("99")).toBeUndefined();
  });
});
