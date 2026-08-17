import { describe, expect, it } from "vitest";
import { estadoDoPin, PESO_ESTADO_PIN } from "@/lib/logistica/pins";
import { computeDocStatus } from "@/lib/rh/documentos";
import type { Colaborador } from "@/types";

const AGORA = new Date(2026, 6, 26).getTime();
const emDias = (d: number) => new Date(AGORA + d * 24 * 60 * 60 * 1000).toISOString();

const colab = (p: Partial<Colaborador>): Colaborador =>
  ({
    id: "c1",
    nome: "Fulano",
    ativo: true,
    obraAtualId: null,
    statusEspecial: null,
    mobilizacaoPendente: null,
    documentos: [],
    ...p,
  }) as Colaborador;

describe("rh · computeDocStatus", () => {
  it("não acusa nada quando não há documentos ou vencimentos próximos", () => {
    expect(computeDocStatus(colab({}), AGORA)).toBeNull();
    expect(
      computeDocStatus(
        colab({ documentos: [{ nome: "ASO", dataVencimento: emDias(90) }] as never }),
        AGORA,
      ),
    ).toBeNull();
  });

  it("acusa documento a vencer dentro da janela de 30 dias", () => {
    const status = computeDocStatus(
      colab({ documentos: [{ nome: "ASO", dataVencimento: emDias(10) }] as never }),
      AGORA,
    );
    expect(status?.kind).toBe("vencendo");
    expect(status?.tooltip).toContain("ASO");
  });

  it("acusa documento vencido", () => {
    const status = computeDocStatus(
      colab({ documentos: [{ nome: "NR-35", dataVencimento: emDias(-5) }] as never }),
      AGORA,
    );
    expect(status?.kind).toBe("vencido");
    expect(status?.tooltip).toContain("NR-35");
  });

  it("reporta o vencimento mais antigo quando há vários", () => {
    const status = computeDocStatus(
      colab({
        documentos: [
          { nome: "ASO", dataVencimento: emDias(10) },
          { nome: "NR-35", dataVencimento: emDias(-5) },
        ] as never,
      }),
      AGORA,
    );
    expect(status?.kind).toBe("vencido");
    expect(status?.tooltip).toContain("NR-35");
  });

  it("ignora data inválida ou ausente", () => {
    expect(
      computeDocStatus(
        colab({
          documentos: [
            { nome: "Sem data", dataVencimento: "" },
            { nome: "Inválida", dataVencimento: "não é data" },
          ] as never,
        }),
        AGORA,
      ),
    ).toBeNull();
  });
});

describe("logistica · estadoDoPin", () => {
  it("documento vencido tem precedência sobre tudo", () => {
    expect(
      estadoDoPin(
        colab({
          documentos: [{ nome: "NR-35", dataVencimento: emDias(-5) }] as never,
          mobilizacaoPendente: {
            obraDestinoId: "10",
            obraDestinoNome: "Obra X",
            dataMobilizacao: "01/08/2026",
          },
        }),
      ),
    ).toBe("atencao");
  });

  it("mobilização pendente vence disponível/alocado", () => {
    expect(
      estadoDoPin(
        colab({
          mobilizacaoPendente: {
            obraDestinoId: "10",
            obraDestinoNome: "Obra X",
            dataMobilizacao: "01/08/2026",
          },
        }),
      ),
    ).toBe("pendente");
  });

  it("distingue disponível de alocado", () => {
    expect(estadoDoPin(colab({}))).toBe("disponivel");
    expect(estadoDoPin(colab({ statusEspecial: "ferias" }))).toBe("disponivel");
    expect(estadoDoPin(colab({ obraAtualId: "10" }))).toBe("alocado");
    expect(estadoDoPin(colab({ ativo: false }))).toBe("alocado");
  });

  it("prioriza disponível na escolha do pin representante do agrupamento", () => {
    expect(PESO_ESTADO_PIN.disponivel).toBeLessThan(PESO_ESTADO_PIN.alocado);
    expect(PESO_ESTADO_PIN.atencao).toBeLessThan(PESO_ESTADO_PIN.alocado);
  });
});
