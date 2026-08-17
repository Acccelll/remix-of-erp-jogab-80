import { describe, expect, it } from "vitest";
import {
  reconciliarLeanCpm,
  type CronogramaItemLite,
  type PacoteReconLite,
} from "../reconciliacao";

const item = (id: string, over: Partial<CronogramaItemLite> = {}): CronogramaItemLite => ({
  id,
  obra_id: "o1",
  nome: `item ${id}`,
  status: "em_andamento",
  ...over,
});

const pac = (
  id: string,
  cronograma_item_id: string | null,
  status: string | null,
): PacoteReconLite => ({ id, obra_id: "o1", cronograma_item_id, status });

describe("reconciliarLeanCpm", () => {
  it("marca item sem pacote e conta órfãos", () => {
    const r = reconciliarLeanCpm(
      [item("i1"), item("i2")],
      [pac("p1", "i1", "pendente"), pac("p2", null, "pendente")],
    );
    expect(r.itens_sem_pacote.map((i) => i.id)).toEqual(["i2"]);
    expect(r.pacotes_orfaos.map((p) => p.id)).toEqual(["p2"]);
    expect(r.totais).toEqual({ itens: 2, itens_cobertos: 1, pacotes: 2, pacotes_orfaos: 1 });
  });

  it("agrega comprometidos e concluídos por item", () => {
    const r = reconciliarLeanCpm(
      [item("i1")],
      [
        pac("p1", "i1", "concluido"),
        pac("p2", "i1", "comprometido"),
        pac("p3", "i1", "pendente"),
      ],
    );
    const c = r.cobertura[0];
    expect(c.total_pacotes).toBe(3);
    expect(c.comprometidos).toBe(2); // comprometido + concluido
    expect(c.concluidos).toBe(1);
    expect(c.completo_lean).toBe(false);
  });

  it("detecta divergência: pacotes 100% concluídos, CPM ainda em andamento", () => {
    const r = reconciliarLeanCpm(
      [item("i1", { status: "em_andamento" })],
      [pac("p1", "i1", "concluido"), pac("p2", "i1", "concluido")],
    );
    expect(r.itens_divergentes.map((d) => d.item_id)).toEqual(["i1"]);
    expect(r.cobertura[0].completo_lean).toBe(true);
    expect(r.cobertura[0].divergente).toBe(true);
  });

  it("não marca divergência quando CPM já está concluído", () => {
    const r = reconciliarLeanCpm(
      [item("i1", { status: "concluida" })],
      [pac("p1", "i1", "concluido")],
    );
    expect(r.itens_divergentes).toEqual([]);
    expect(r.cobertura[0].completo_lean).toBe(true);
    expect(r.cobertura[0].divergente).toBe(false);
  });
});
