import { describe, expect, it, vi } from "vitest";
import {
  criarRegistroDocumento,
  documentosContratoVencendo,
  documentosDoContrato,
  proximaVersaoDocumento,
  resumoDocumental,
  type ContratoDocumento,
} from "../documentos";

const docs: ContratoDocumento[] = [
  {
    id: "1",
    contratoId: "c1",
    nomeArquivo: "contrato.pdf",
    mime: "application/pdf",
    tamanho: 10,
    versao: 1,
    dataUpload: "2026-01-01T00:00:00.000Z",
    usuario: "A",
    statusAssinatura: "pendente",
    dataUrl: "data:application/pdf;base64,AA==",
  },
  {
    id: "2",
    contratoId: "c1",
    nomeArquivo: "contrato.pdf",
    mime: "application/pdf",
    tamanho: 11,
    versao: 2,
    dataUpload: "2026-01-02T00:00:00.000Z",
    usuario: "B",
    statusAssinatura: "assinado",
    dataUrl: "data:application/pdf;base64,BB==",
  },
  {
    id: "3",
    contratoId: "c2",
    nomeArquivo: "contrato.pdf",
    mime: "application/pdf",
    tamanho: 12,
    versao: 1,
    dataUpload: "2026-01-03T00:00:00.000Z",
    usuario: "C",
    statusAssinatura: "enviado",
    dataUrl: "data:application/pdf;base64,CC==",
  },
];

describe("documentos de contratos (PRO-021.slice-01)", () => {
  it("calcula próxima versão por contrato e nome do arquivo", () => {
    expect(proximaVersaoDocumento(docs, "c1", "CONTRATO.pdf")).toBe(3);
    expect(proximaVersaoDocumento(docs, "c2", "contrato.pdf")).toBe(2);
    expect(proximaVersaoDocumento(docs, "c1", "aditivo.pdf")).toBe(1);
  });

  it("cria registro pendente com versão correta", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("novo-id" as `${string}-${string}-${string}-${string}-${string}`);
    const r = criarRegistroDocumento(docs, {
      contratoId: "c1",
      nomeArquivo: "contrato.pdf",
      mime: "application/pdf",
      tamanho: 99,
      dataUrl: "data:application/pdf;base64,DD==",
      usuario: "Gestor",
      agora: "2026-01-04T00:00:00.000Z",
    });

    expect(r).toMatchObject({
      id: "novo-id",
      versao: 3,
      statusAssinatura: "pendente",
      usuario: "Gestor",
    });
  });

  it("lista somente documentos do contrato e ordena versões recentes primeiro", () => {
    const r = documentosDoContrato(docs, "c1");
    expect(r.map((d) => d.id)).toEqual(["2", "1"]);
  });

  it("resume assinatura por status operacional", () => {
    expect(resumoDocumental(docs)).toEqual({ total: 3, assinados: 1, pendentes: 1, enviados: 1 });
  });

  it("lista documentos com validoAte dentro do horizonte (PRO-021.slice-02)", () => {
    const hoje = new Date(2026, 5, 10);
    const comValidade: ContratoDocumento[] = [
      { ...docs[0], id: "v1", validoAte: "2026-06-20" }, // 10 dias
      { ...docs[0], id: "v2", validoAte: "2026-06-01" }, // -9 (vencido)
      { ...docs[0], id: "v3", validoAte: "2026-08-01" }, // fora
      { ...docs[0], id: "v4" }, // sem validade
    ];
    const r = documentosContratoVencendo(comValidade, 30, hoje);
    expect(r.map((d) => d.documento.id)).toEqual(["v2", "v1"]);
    expect(r[0].situacao).toBe("vencido");
    expect(r[1].diasRestantes).toBe(10);
  });
});
