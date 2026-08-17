import { describe, expect, it } from "vitest";
import {
  formatarNumeroRdo,
  gerarNumeroRdo,
  numeroDuplicado,
  podeAssinar,
  podeEditar,
  podeFechar,
  proximoSequencial,
  validarAssinatura,
  type RdoRegistroLocal,
} from "../numeracao";

const reg = (over: Partial<RdoRegistroLocal>): RdoRegistroLocal => ({
  id: over.id ?? Math.random().toString(),
  obraId: over.obraId ?? "obra-1",
  ano: over.ano ?? 2026,
  sequencial: over.sequencial ?? 1,
  numero: over.numero ?? formatarNumeroRdo(over.ano ?? 2026, over.sequencial ?? 1),
  fechado: over.fechado ?? false,
  fechadoEm: over.fechadoEm,
  fechadoPor: over.fechadoPor,
  assinadoEm: over.assinadoEm,
  assinadoPor: over.assinadoPor,
  assinaturaDataUrl: over.assinaturaDataUrl,
});

describe("rdo/numeracao", () => {
  it("formata número com padding de 4 dígitos", () => {
    expect(formatarNumeroRdo(2026, 7)).toBe("RDO-2026-0007");
  });

  it("proximoSequencial começa em 1 e ignora outras obras/anos", () => {
    const regs = [reg({ obraId: "obra-1", sequencial: 3 }), reg({ obraId: "obra-2", sequencial: 9 })];
    expect(proximoSequencial(regs, "obra-1", 2026)).toBe(4);
    expect(proximoSequencial(regs, "obra-1", 2025)).toBe(1);
    expect(proximoSequencial(regs, "obra-3", 2026)).toBe(1);
  });

  it("gerarNumeroRdo usa o ano da data informada", () => {
    const out = gerarNumeroRdo({ obraId: "o1", data: "2025-03-10", registros: [] });
    expect(out).toEqual({ ano: 2025, sequencial: 1, numero: "RDO-2025-0001" });
  });

  it("podeEditar bloqueia RDO fechado", () => {
    expect(podeEditar(reg({ fechado: true })).ok).toBe(false);
    expect(podeEditar(reg({ fechado: false })).ok).toBe(true);
    expect(podeEditar(null).ok).toBe(true);
  });

  it("podeFechar recusa RDO já fechado ou inexistente", () => {
    expect(podeFechar(null).ok).toBe(false);
    expect(podeFechar(reg({ fechado: true })).ok).toBe(false);
    expect(podeFechar(reg({ fechado: false })).ok).toBe(true);
  });

  it("numeroDuplicado ignora o próprio id", () => {
    const r = reg({ id: "a", numero: "RDO-2026-0001" });
    expect(numeroDuplicado([r], "RDO-2026-0001")).toBe(true);
    expect(numeroDuplicado([r], "RDO-2026-0001", "a")).toBe(false);
  });

  it("podeAssinar bloqueia assinatura duplicada", () => {
    expect(podeAssinar(null).ok).toBe(false);
    expect(podeAssinar(reg({ assinaturaDataUrl: "data:image/png;base64,abc" })).ok).toBe(false);
    expect(podeAssinar(reg({ assinaturaDataUrl: undefined })).ok).toBe(true);
  });

  it("validarAssinatura exige responsável e imagem em data URL", () => {
    expect(validarAssinatura({ assinadoPor: "", assinaturaDataUrl: "data:image/png;base64,abc" }).ok).toBe(false);
    expect(validarAssinatura({ assinadoPor: "Resp", assinaturaDataUrl: "abc" }).ok).toBe(false);
    expect(validarAssinatura({ assinadoPor: "Resp", assinaturaDataUrl: "data:image/png;base64,abc" }).ok).toBe(true);
  });
});
