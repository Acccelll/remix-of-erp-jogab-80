import { describe, it, expect } from "vitest";
import {
  diasSemComunicar,
  normalizaDataHora,
  normalizarDispositivos,
  saudeDoRep,
} from "../dispositivos";

describe("normalizaDataHora", () => {
  it("troca o T do ISO pelo espaço que o MySQL aceita em DATETIME", () => {
    expect(normalizaDataHora("2026-08-03T14:25:10")).toBe("2026-08-03 14:25:10");
    expect(normalizaDataHora("2026-08-03T14:25:10.500Z")).toBe("2026-08-03 14:25:10");
  });

  it("completa segundos quando faltam", () => {
    expect(normalizaDataHora("2026-08-03T14:25")).toBe("2026-08-03 14:25:00");
  });

  it("aceita só data e formato brasileiro", () => {
    expect(normalizaDataHora("2026-08-03")).toBe("2026-08-03 00:00:00");
    expect(normalizaDataHora("3/8/2026 07:15")).toBe("2026-08-03 07:15:00");
  });

  it("devolve null para vazio ou lixo", () => {
    expect(normalizaDataHora(null)).toBeNull();
    expect(normalizaDataHora("")).toBeNull();
    expect(normalizaDataHora("nunca")).toBeNull();
  });
});

describe("normalizarDispositivos", () => {
  it("lê os campos do /device por alias tolerante", () => {
    const [d] = normalizarDispositivos([
      {
        id: 55,
        name: "REP OBRA 210",
        serial: "ABC123",
        version: "1.4.2",
        status: "ativo",
        statusPapel: "ok",
        linkedCompanyId: 3,
        numberOfPeople: 120,
        numberOfFingerprints: 240,
        lastConnectionDate: "2026-08-03T06:00:00",
        lastSyncDate: "2026-08-03T05:00:00",
      },
    ]);
    expect(d).toEqual({
      id: 55,
      nome: "REP OBRA 210",
      serial: "ABC123",
      versao: "1.4.2",
      status: "ativo",
      statusPapel: "ok",
      idEmpresa: "3",
      numPessoas: 120,
      numDigitais: 240,
      ultimaConexao: "2026-08-03 06:00:00",
      ultimaSincronizacao: "2026-08-03 05:00:00",
    });
  });

  it("descarta equipamento sem id — não dá para pedir AFD dele", () => {
    expect(normalizarDispositivos([{ name: "sem id" }, { id: 0, name: "zero" }])).toEqual([]);
  });

  it("tolera equipamento que nunca comunicou", () => {
    const [d] = normalizarDispositivos([{ id: 7, name: "NOVO" }]);
    expect(d.ultimaConexao).toBeNull();
    expect(d.numPessoas).toBeNull();
  });
});

describe("diasSemComunicar", () => {
  it("conta dias inteiros", () => {
    expect(diasSemComunicar("2026-08-01 08:00:00", "2026-08-04 09:00:00")).toBe(3);
    expect(diasSemComunicar("2026-08-04 08:00:00", "2026-08-04 09:00:00")).toBe(0);
  });

  it("não devolve negativo quando o relógio do REP está adiantado", () => {
    expect(diasSemComunicar("2026-08-10 08:00:00", "2026-08-04 09:00:00")).toBe(0);
  });

  it("devolve null sem data de conexão", () => {
    expect(diasSemComunicar(null, "2026-08-04 09:00:00")).toBeNull();
  });
});

describe("saudeDoRep", () => {
  const agora = "2026-08-04 09:00:00";

  it("classifica pela idade da última comunicação", () => {
    expect(saudeDoRep("2026-08-04 08:00:00", agora)).toBe("ok");
    expect(saudeDoRep("2026-08-03 08:00:00", agora)).toBe("atencao");
    expect(saudeDoRep("2026-08-01 08:00:00", agora)).toBe("critico");
  });

  it("equipamento que nunca reportou é 'desconhecido', não 'ok'", () => {
    // É justamente o mais suspeito — tratá-lo como saudável esconderia o problema.
    expect(saudeDoRep(null, agora)).toBe("desconhecido");
  });
});
