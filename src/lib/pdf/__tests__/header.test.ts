import { describe, it, expect, vi } from "vitest";
import { drawInstitucionalHeader, drawInstitucionalLines } from "../header";

function makeDocStub() {
  const calls: any[] = [];
  const doc: any = {
    setFontSize: vi.fn((s: number) => calls.push(["setFontSize", s])),
    setFont: vi.fn((...a: any[]) => calls.push(["setFont", ...a])),
    setTextColor: vi.fn((c: number) => calls.push(["setTextColor", c])),
    text: vi.fn((t: string, x: number, y: number) => calls.push(["text", t, x, y])),
    addImage: vi.fn((...a: any[]) => calls.push(["addImage", ...a])),
  };
  return { doc, calls };
}

describe("drawInstitucionalHeader", () => {
  it("sem logo e sem linhas institucionais devolve defaultStartY 82", () => {
    const { doc, calls } = makeDocStub();
    const y = drawInstitucionalHeader(doc, { titulo: "T", subtitulo: "S" });
    expect(y).toBe(82);
    // título na margem esquerda
    expect(calls.find((c) => c[0] === "text" && c[1] === "T")?.[2]).toBe(40);
  });

  it("com logo desloca título e mantém startY 82 sem linhas", () => {
    const { doc, calls } = makeDocStub();
    const y = drawInstitucionalHeader(doc, {
      titulo: "T",
      subtitulo: "S",
      logoDataUrl: "data:image/png;base64,AAAA",
    });
    expect(y).toBe(82);
    expect(calls.find((c) => c[0] === "text" && c[1] === "T")?.[2]).toBe(100);
    expect(calls.some((c) => c[0] === "addImage")).toBe(true);
  });

  it("com linhas institucionais empurra startY para baixo", () => {
    const { doc } = makeDocStub();
    const y = drawInstitucionalHeader(doc, {
      titulo: "T",
      subtitulo: "S",
      institucionalLines: ["Razão · CNPJ", "Endereço · fone"],
    });
    // 77 + 2*10 + 2 = 99
    expect(y).toBe(99);
  });

  it("filtra linhas vazias/brancas", () => {
    const { doc } = makeDocStub();
    const y = drawInstitucionalHeader(doc, {
      titulo: "T",
      subtitulo: "S",
      institucionalLines: ["", "   ", "Razão"],
    });
    expect(y).toBe(89); // 77 + 10 + 2
  });

  it("addImage falhando não interrompe (logo silencioso)", () => {
    const { doc } = makeDocStub();
    doc.addImage = () => {
      throw new Error("bad");
    };
    const y = drawInstitucionalHeader(doc, {
      titulo: "T",
      subtitulo: "S",
      logoDataUrl: "data:image/png;base64,AAAA",
    });
    expect(y).toBe(82);
  });
});

describe("drawInstitucionalLines", () => {
  it("centrado: passa align:center para cada linha e retorna y final", () => {
    const { doc, calls } = makeDocStub();
    // stub aceita opts como 4º arg
    doc.text = vi.fn((t: string, x: number, y: number, opts?: any) =>
      calls.push(["text", t, x, y, opts]),
    );
    const y = drawInstitucionalLines(doc, {
      lines: ["Razão", "Endereço"],
      x: 400,
      startY: 46,
      align: "center",
    });
    expect(y).toBe(66); // 46 + 2*10
    const textCalls = calls.filter((c) => c[0] === "text");
    expect(textCalls).toHaveLength(2);
    expect(textCalls[0][4]).toEqual({ align: "center" });
  });

  it("retorna startY quando lines está vazio", () => {
    const { doc } = makeDocStub();
    expect(drawInstitucionalLines(doc, { lines: [], x: 40, startY: 50 })).toBe(50);
    expect(drawInstitucionalLines(doc, { lines: ["", "  "], x: 40, startY: 50 })).toBe(50);
  });
});
