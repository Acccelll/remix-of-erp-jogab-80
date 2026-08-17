import { describe, expect, it } from "vitest";
import {
  classificarEvento,
  classificarEventoStatus,
  rotuloStatus,
  statusAtualColaborador,
} from "@/lib/rh/statusHistorico";

describe("rotuloStatus", () => {
  it("aceita o vocabulário do banco", () => {
    expect(rotuloStatus("ferias")).toMatchObject({ label: "Férias", tone: "info" });
    expect(rotuloStatus("folga").label).toBe("Folga");
    expect(rotuloStatus("afastamento").tone).toBe("warning");
    expect(rotuloStatus("sem_alocacao").label).toBe("Sem alocação");
  });

  it("aceita id de coluna com underscores", () => {
    // O quadro de colaboradores usa `ferias`; os de patrimônio e veículo usam
    // `__ferias__`. Não reconhecer as duas formas era o que fazia uma ida para
    // férias ser gravada com destino "Sem Alocação".
    expect(rotuloStatus("__ferias__").label).toBe("Férias");
    expect(rotuloStatus("__afastamento__").label).toBe("Afastamento");
  });

  it("não inventa status para movimentação antiga sem destino gravado", () => {
    expect(rotuloStatus("indeterminado")).toMatchObject({ label: "Saiu da obra", tone: "muted" });
  });
});

describe("classificarEvento (evento tipado)", () => {
  it("resolve troca de status por campos, não por prosa", () => {
    expect(
      classificarEvento({
        tipo: "status",
        obraOrigemNome: "212 - Potirendaba",
        statusDestino: "ferias",
      }),
    ).toMatchObject({
      label: "Férias",
      tone: "info",
      origem: "212 - Potirendaba",
      destino: "Férias",
    });
  });

  it("resolve a volta de férias para obra preservando a origem", () => {
    // A origem vinha como "Sem Alocação" porque o status não era consultado.
    expect(
      classificarEvento({
        tipo: "mobilizacao",
        statusOrigem: "ferias",
        obraDestinoNome: "214",
      }),
    ).toMatchObject({ label: "Alocado", origem: "Férias", destino: "214" });
  });

  it("classifica inativação e reativação pelo tipo", () => {
    expect(classificarEvento({ tipo: "inativacao" })?.label).toBe("Inativo");
    expect(classificarEvento({ tipo: "reativacao" })?.label).toBe("Ativo");
  });

  it("cai na observação para eventos de texto livre", () => {
    expect(
      classificarEvento({ tipo: "outro", observacao: "Inativação programada cancelada" })?.label,
    ).toBe("Cancelado");
    expect(classificarEvento({ tipo: "outro" })).toBeNull();
  });
});

describe("classificarEventoStatus", () => {
  it("classifica transição para Férias", () => {
    const r = classificarEventoStatus('Status alterado de "212 - Potirendaba" para "Férias" em 12/08/2026');
    expect(r).toMatchObject({ label: "Férias", tone: "info", origem: "212 - Potirendaba", destino: "Férias" });
  });

  it("classifica Folga e Afastamento", () => {
    expect(classificarEventoStatus('Status alterado de "Obra X" para "Folga" em 01/01/2026')?.label).toBe("Folga");
    expect(classificarEventoStatus('Status alterado de "Obra X" para "Afastamento" em 01/01/2026')?.tone).toBe("warning");
  });

  it("classifica Sem Alocação e obra", () => {
    expect(classificarEventoStatus('Status alterado de "Obra X" para "Sem Alocação" em 01/01/2026')?.label).toBe("Sem alocação");
    expect(classificarEventoStatus('Status alterado de "Folga" para "Obra Y" em 01/01/2026')).toMatchObject({
      label: "Alocado",
      tone: "success",
    });
  });

  it("classifica inativação, programação e reativação", () => {
    expect(classificarEventoStatus("Status alterado para Inativo (rescisão) — desligamento em 12/08/2026")?.label).toBe("Inativo");
    expect(classificarEventoStatus("Inativação programada para 2026-09-01 (rescisão)")?.label).toBe("Programado");
    expect(classificarEventoStatus("Inativação programada cancelada")?.label).toBe("Cancelado");
    expect(classificarEventoStatus("Reativado")?.label).toBe("Ativo");
  });

  it("retorna null para eventos genéricos", () => {
    expect(classificarEventoStatus("Dados cadastrais atualizados")).toBeNull();
    expect(classificarEventoStatus("")).toBeNull();
  });
});

describe("statusAtualColaborador", () => {
  it("resolve estados principais", () => {
    expect(statusAtualColaborador({ ativo: false }).label).toBe("Inativo");
    expect(statusAtualColaborador({ ativo: true, dataInativacao: "2026-09-01" }).label).toBe("Inativação programada");
    expect(statusAtualColaborador({ ativo: true, statusEspecial: "ferias" }).label).toBe("Férias");
    expect(statusAtualColaborador({ ativo: true }).label).toBe("Ativo");
  });
});
