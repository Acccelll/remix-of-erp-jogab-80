import { describe, it, expect } from "vitest";
import {
  isNCAtiva,
  ncParaCard,
  ncParaRestricao,
  severidadeParaTipoRestricao,
  type NCDerivavel,
} from "@/lib/qualidade/nc-derivados";

const base: NCDerivavel = {
  id: "nc-1",
  obraId: "obra-1",
  severidade: "alta",
  descricao: "Falta EPI na frente A",
  status: "aberta",
  responsavelId: "user-1",
  prazoISO: "2026-07-20T00:00:00.000Z",
  inspecaoId: "insp-1",
};

describe("isNCAtiva", () => {
  it("é ativa em aberta/em_tratativa/aguardando_reinspecao", () => {
    expect(isNCAtiva("aberta")).toBe(true);
    expect(isNCAtiva("em_tratativa")).toBe(true);
    expect(isNCAtiva("aguardando_reinspecao")).toBe(true);
  });
  it("não é ativa em resolvida/cancelada", () => {
    expect(isNCAtiva("resolvida")).toBe(false);
    expect(isNCAtiva("cancelada")).toBe(false);
  });
});

describe("severidadeParaTipoRestricao", () => {
  it("alta/critica → seguranca; demais → outro", () => {
    expect(severidadeParaTipoRestricao("alta")).toBe("seguranca");
    expect(severidadeParaTipoRestricao("critica")).toBe("seguranca");
    expect(severidadeParaTipoRestricao("media")).toBe("outro");
    expect(severidadeParaTipoRestricao(null)).toBe("outro");
  });
});

describe("ncParaRestricao", () => {
  it("mapeia NC ativa em restrição aberta com origem preservada", () => {
    const r = ncParaRestricao(base);
    expect(r).toEqual({
      obra_id: "obra-1",
      tipo: "seguranca",
      descricao: "Falta EPI na frente A",
      responsavel_id: "user-1",
      prazo: "2026-07-20",
      status: "aberta",
      origem_tipo: "nao_conformidade",
      origem_id: "nc-1",
    });
  });
  it("NC resolvida vira restrição resolvida", () => {
    expect(ncParaRestricao({ ...base, status: "resolvida" }).status).toBe("resolvida");
  });
  it("NC cancelada vira restrição cancelada", () => {
    expect(ncParaRestricao({ ...base, status: "cancelada" }).status).toBe("cancelada");
  });
  it("descrição vazia usa fallback com id", () => {
    expect(ncParaRestricao({ ...base, descricao: "  " }).descricao).toBe("NC nc-1");
  });
});

describe("ncParaCard", () => {
  it("NC aberta → card aberto não arquivado", () => {
    const c = ncParaCard(base);
    expect(c.status).toBe("aberto");
    expect(c.arquivado).toBe(false);
    expect(c.origem_id).toBe("nc-1");
    expect(c.titulo.startsWith("NC · ")).toBe(true);
  });
  it("NC em_tratativa/aguardando_reinspecao → em_andamento", () => {
    expect(ncParaCard({ ...base, status: "em_tratativa" }).status).toBe("em_andamento");
    expect(ncParaCard({ ...base, status: "aguardando_reinspecao" }).status).toBe("em_andamento");
  });
  it("NC resolvida → concluido; cancelada → cancelado + arquivado", () => {
    expect(ncParaCard({ ...base, status: "resolvida" }).status).toBe("concluido");
    const cancel = ncParaCard({ ...base, status: "cancelada" });
    expect(cancel.status).toBe("cancelado");
    expect(cancel.arquivado).toBe(true);
  });
  it("prazo ISO reduzido a YYYY-MM-DD", () => {
    expect(ncParaCard(base).prazo).toBe("2026-07-20");
  });
});
