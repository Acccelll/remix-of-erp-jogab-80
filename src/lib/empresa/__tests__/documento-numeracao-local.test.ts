import { beforeEach, describe, expect, it } from "vitest";
import {
  getDocumentoNumeroLocal,
  listDocumentoNumeracaoLocal,
  registrarDocumentoNumeroImportadoLocal,
  registrarDocumentoNumeroLocal,
} from "../documento-numeracao-local";
import { empresaParametrizacaoRepo } from "../parametrizacao";

beforeEach(() => {
  localStorage.clear();
});

describe("documento-numeracao-local · PRO-031", () => {
  it("registra e recupera número documental por tipo", () => {
    const registro = registrarDocumentoNumeroLocal({
      documentoId: "cot-1",
      tipo: "cotacao",
      empresaId: "emp-1",
      numero: "COT-E1-09",
      sequencial: 9,
      criadoEm: "2026-07-14T00:00:00.000Z",
    });

    expect(registro.numero).toBe("COT-E1-09");
    expect(getDocumentoNumeroLocal("cot-1", "cotacao")?.numero).toBe("COT-E1-09");
    expect(getDocumentoNumeroLocal("cot-1", "requisicao")).toBeNull();
    expect(listDocumentoNumeracaoLocal("cotacao")).toHaveLength(1);
  });

  it("é idempotente para o mesmo documento e tipo", () => {
    registrarDocumentoNumeroLocal({
      documentoId: "cot-1",
      tipo: "cotacao",
      numero: "COT-001",
      sequencial: 1,
    });

    const repetido = registrarDocumentoNumeroLocal({
      documentoId: "cot-1",
      tipo: "cotacao",
      numero: "COT-002",
      sequencial: 2,
    });

    expect(repetido.numero).toBe("COT-001");
    expect(listDocumentoNumeracaoLocal()).toHaveLength(1);
  });

  it("semeia número importado sem duplicar e avança sequência configurada", () => {
    empresaParametrizacaoRepo.setNumeracao("emp-1", "contrato", {
      prefixo: "CTR",
      padding: 6,
      proximo: 5,
    });

    const registro = registrarDocumentoNumeroImportadoLocal({
      documentoId: "ctr-25",
      tipo: "contrato",
      empresaId: "emp-1",
      numero: "CTR-000025",
    });
    const duplicado = registrarDocumentoNumeroImportadoLocal({
      documentoId: "ctr-26",
      tipo: "contrato",
      empresaId: "emp-1",
      numero: "ctr-000025",
    });

    expect(registro?.sequencial).toBe(25);
    expect(duplicado).toBeNull();
    expect(listDocumentoNumeracaoLocal("contrato")).toHaveLength(1);
    expect(empresaParametrizacaoRepo.get("emp-1").numeracoes.contrato?.proximo).toBe(26);
  });
});