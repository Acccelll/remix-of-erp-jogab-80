import { describe, it, expect } from "vitest";
import { ncParaCard, ncParaRestricao, type NCDerivavel } from "@/lib/qualidade/nc-derivados";
import {
  cardToRow,
  diffCard,
  diffRestricao,
  restricaoToRow,
} from "@/lib/qualidade/nc-persistencia";

const nc: NCDerivavel = {
  id: "nc-9",
  obraId: "obra-1",
  severidade: "alta",
  descricao: "Escada sem guarda-corpo",
  status: "aberta",
  responsavelId: "user-1",
  prazoISO: "2026-08-01T00:00:00.000Z",
};

describe("restricaoToRow / diffRestricao", () => {
  it("gera linha completa a partir do payload", () => {
    const row = restricaoToRow(ncParaRestricao(nc));
    expect(row).toEqual({
      obra_id: "obra-1",
      tipo: "seguranca",
      descricao: "Escada sem guarda-corpo",
      responsavel_id: "user-1",
      prazo: "2026-08-01",
      status: "aberta",
      origem_tipo: "nao_conformidade",
      origem_id: "nc-9",
    });
  });
  it("diff retorna vazio quando nada mudou", () => {
    const row = restricaoToRow(ncParaRestricao(nc));
    expect(diffRestricao(row, row)).toEqual({});
  });
  it("diff retorna apenas os campos alterados", () => {
    const before = restricaoToRow(ncParaRestricao(nc));
    const after = restricaoToRow(ncParaRestricao({ ...nc, status: "resolvida" }));
    expect(diffRestricao(before, after)).toEqual({ status: "resolvida" });
  });
});

describe("cardToRow / diffCard", () => {
  it("gera linha completa a partir do payload", () => {
    const row = cardToRow(ncParaCard(nc));
    expect(row.tipo).toBe("nc");
    expect(row.status).toBe("aberto");
    expect(row.origem_externa).toBe("nao_conformidade");
    expect(row.origem_id).toBe("nc-9");
  });
  it("diff em card novo (before vazio) envia todos os campos", () => {
    const after = cardToRow(ncParaCard(nc));
    const patch = diffCard(null, after);
    expect(patch).toEqual(after);
  });
  it("diff conservador não sobrescreve título/descrição editados", () => {
    const after = cardToRow(ncParaCard({ ...nc, status: "em_tratativa" }));
    const before = { ...after, status: "aberto", titulo: "título editado" };
    const patch = diffCard(before, after);
    expect(patch).toEqual({ status: "em_andamento" });
    expect(patch.titulo).toBeUndefined();
  });
  it("diff conservador aplica arquivado e status ao cancelar", () => {
    const cancelado = cardToRow(ncParaCard({ ...nc, status: "cancelada" }));
    const before = cardToRow(ncParaCard(nc));
    const patch = diffCard(before, cancelado);
    expect(patch.status).toBe("cancelado");
    expect(patch.arquivado).toBe(true);
  });
});
