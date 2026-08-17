import { beforeEach, describe, expect, it } from "vitest";
import { empresaParametrizacaoRepo } from "@/lib/empresa/parametrizacao";
import {
  emitirNumeroCustomizado,
  previewNumeroCustomizado,
  temNumeracaoCustomizada,
} from "../numeracao-documentos";

beforeEach(() => {
  localStorage.clear();
});

describe("numeracao-documentos · PRO-031", () => {
  it("só ativa emissão quando o tipo foi customizado pela empresa", () => {
    expect(temNumeracaoCustomizada("emp-1", "medicao")).toBe(false);
    expect(previewNumeroCustomizado("emp-1", "medicao")).toBeNull();
    expect(emitirNumeroCustomizado("emp-1", "medicao")).toBeNull();
    expect(empresaParametrizacaoRepo.get("emp-1").numeracoes.medicao).toBeUndefined();
  });

  it("emite número customizado, avança sequência e permite rollback", () => {
    empresaParametrizacaoRepo.setNumeracao("emp-1", "medicao", {
      prefixo: "MED-E1",
      padding: 2,
      proximo: 7,
    });

    expect(previewNumeroCustomizado("emp-1", "medicao")).toBe("MED-E1-07");
    const emitido = emitirNumeroCustomizado("emp-1", "medicao");

    expect(emitido).toMatchObject({ numero: "MED-E1-07", emitido: 7 });
    expect(empresaParametrizacaoRepo.get("emp-1").numeracoes.medicao?.proximo).toBe(8);

    emitido?.rollback();
    expect(empresaParametrizacaoRepo.get("emp-1").numeracoes.medicao?.proximo).toBe(7);
  });
});