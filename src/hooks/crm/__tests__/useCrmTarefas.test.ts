import { describe, expect, it } from "vitest";
import {
  calcularDataAdiada,
  classificarTarefa,
  proximaTarefaAberta,
  type CrmTarefa,
} from "../useCrmTarefas";

const base = {
  oportunidadeId: "op1",
  responsavelLogin: "user",
  status: "aberta" as const,
  criadaEm: "2026-01-01T00:00:00.000Z",
};

describe("useCrmTarefas helpers (PRO-002)", () => {
  it("classifica vencida, hoje e futura por data ISO", () => {
    expect(classificarTarefa({ ...base, id: "1", titulo: "A", data: "2026-01-09" }, "2026-01-10")).toBe("vencida");
    expect(classificarTarefa({ ...base, id: "2", titulo: "B", data: "2026-01-10" }, "2026-01-10")).toBe("hoje");
    expect(classificarTarefa({ ...base, id: "3", titulo: "C", data: "2026-01-11" }, "2026-01-10")).toBe("futura");
  });

  it("retorna a próxima tarefa aberta por oportunidade", () => {
    const tarefas: CrmTarefa[] = [
      { ...base, id: "futura", titulo: "Depois", data: "2026-01-20" },
      { ...base, id: "concluida", titulo: "Feita", data: "2026-01-05", status: "concluida" },
      { ...base, id: "proxima", titulo: "Agora", data: "2026-01-10" },
      { ...base, id: "outra", oportunidadeId: "op2", titulo: "Outra", data: "2026-01-01" },
    ];

    expect(proximaTarefaAberta(tarefas, "op1")?.id).toBe("proxima");
    expect(proximaTarefaAberta(tarefas, "op2")?.id).toBe("outra");
  });

  describe("calcularDataAdiada (slice-04)", () => {
    it("adia tarefa futura a partir da própria data", () => {
      expect(calcularDataAdiada("2026-01-15", 3, "2026-01-10")).toBe("2026-01-18");
    });

    it("adia tarefa vencida a partir de hoje", () => {
      expect(calcularDataAdiada("2026-01-05", 7, "2026-01-10")).toBe("2026-01-17");
    });

    it("adia tarefa marcada para hoje a partir de hoje", () => {
      expect(calcularDataAdiada("2026-01-10", 1, "2026-01-10")).toBe("2026-01-11");
    });

    it("respeita virada de mês", () => {
      expect(calcularDataAdiada("2026-01-30", 3, "2026-01-10")).toBe("2026-02-02");
    });
  });
});