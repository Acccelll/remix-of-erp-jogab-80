import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportRomaneioToPDF } from "../romaneio-pdf";

// `exportRomaneioToPDF` termina em `doc.save()`, que grava de verdade: rodar a
// suíte deixava dois `romaneio_*.pdf` na raiz do repositório, a um descuido de
// serem commitados.
//
// Só a escrita é trocada — o documento continua sendo montado inteiro, que é o
// que estes casos exercitam. Daí embrulhar o construtor em vez de dublar o
// módulo: no jsPDF 4 o construtor devolve um objeto simples, com `save` como
// propriedade própria de cada instância, então não há protótipo para espionar.
const { salvos } = vi.hoisted(() => ({ salvos: [] as string[] }));

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>();
  const Real = mod.default as unknown as new (...args: unknown[]) => { save: unknown };
  const Embrulhado = function (...args: unknown[]) {
    const doc = new Real(...args);
    doc.save = (nome: string) => {
      salvos.push(nome);
      return doc;
    };
    return doc;
  };
  return { ...mod, default: Embrulhado, jsPDF: Embrulhado };
});

beforeEach(() => {
  salvos.length = 0;
});

/** Nome do arquivo com que o PDF teria sido gravado. */
const nomeGravado = () => salvos[0] ?? "";

describe("exportRomaneioToPDF", () => {
  it("gera o documento sem lançar, com itens de estoque e patrimônio", () => {
    expect(() =>
      exportRomaneioToPDF({
        numero: "RM-2026-000001",
        status: "confirmado",
        obraOrigemNome: "Usina A",
        obraDestinoNome: "Usina B",
        veiculoNome: "V-01",
        dataProgramada: "2026-08-10",
        observacao: "Transporte de rotina",
        criadoPorNome: "tester",
        itensEstoque: [
          {
            insumoNome: "Cimento CP-II",
            quantidade: 10,
            unidade: "sc",
            localOrigem: "Usina A",
            localDestino: "Usina B",
          },
        ],
        itensPatrimonio: [{ codigo: "001", nome: "Gerador 20kVA" }],
      }),
    ).not.toThrow();
    // O número do romaneio identifica o arquivo salvo; o carimbo de data
    // separa duas emissões do mesmo romaneio na pasta de downloads.
    expect(nomeGravado()).toMatch(/^romaneio_RM-2026-000001_\d{8}_\d{4}\.pdf$/);
  });

  it("gera o documento sem itens (apenas cabeçalho)", () => {
    expect(() =>
      exportRomaneioToPDF({
        numero: "RM-2026-000002",
        status: "rascunho",
        obraDestinoNome: "Usina B",
        dataProgramada: null,
        itensEstoque: [],
        itensPatrimonio: [],
      }),
    ).not.toThrow();
    expect(nomeGravado()).toMatch(/^romaneio_RM-2026-000002_\d{8}_\d{4}\.pdf$/);
  });
});
