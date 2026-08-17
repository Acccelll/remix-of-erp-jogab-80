// PRO-005.slice-08 — Smoke E2E do pipeline puro: numeração → assinatura → resumo → CSV.
import { describe, expect, it } from "vitest";
import {
  gerarNumeroRdo,
  podeAssinar,
  validarAssinatura,
  type RdoRegistroLocal,
} from "../numeracao";
import { resumoMensalFechados, type RdoFechadoRow } from "../resumo-mensal";
import { resumoMensalToCsv, nomeArquivoResumo } from "../resumo-mensal-csv";

describe("PRO-005 · pipeline RDO (numeração → assinatura → resumo → CSV)", () => {
  it("gera número, assina, agrega e exporta CSV coerente", () => {
    const registros: RdoRegistroLocal[] = [];
    const fechados: RdoFechadoRow[] = [];

    const datas = ["2026-07-01", "2026-07-02", "2026-07-15"];
    for (const data of datas) {
      const gerado = gerarNumeroRdo({ obraId: "obra-a", data, registros });
      const reg: RdoRegistroLocal = {
        id: `rdo-${gerado.sequencial}`,
        obraId: "obra-a",
        ano: gerado.ano,
        sequencial: gerado.sequencial,
        numero: gerado.numero,
        fechado: false,
      };
      expect(podeAssinar(reg).ok).toBe(true);
      const assinatura = { assinadoPor: "Ana", assinaturaDataUrl: "data:image/png;base64,AAA" };
      expect(validarAssinatura(assinatura).ok).toBe(true);
      reg.fechado = true;
      reg.assinadoPor = assinatura.assinadoPor;
      reg.assinaturaDataUrl = assinatura.assinaturaDataUrl;
      reg.assinadoEm = `${data}T18:00:00Z`;
      registros.push(reg);
      fechados.push({
        id: reg.id,
        obra_id: "obra-a",
        data,
        status: "fechado",
        fechado_em: reg.assinadoEm!,
        assinado_por: reg.assinadoPor!,
        numero_documental: reg.numero,
      });
    }

    // números sequenciais canônicos
    expect(registros.map((r) => r.numero)).toEqual([
      "RDO-2026-0001",
      "RDO-2026-0002",
      "RDO-2026-0003",
    ]);

    // não permite reassinar
    expect(podeAssinar(registros[0]).ok).toBe(false);

    // resumo mensal agrega os 3
    const resumo = resumoMensalFechados(fechados);
    expect(resumo).toHaveLength(1);
    expect(resumo[0]).toMatchObject({
      mes: "2026-07",
      obra_id: "obra-a",
      assinado_por: "Ana",
      total: 3,
      primeiro_numero: "RDO-2026-0001",
      ultimo_numero: "RDO-2026-0003",
    });

    // CSV serializado com BOM e faixa correta
    const csv = resumoMensalToCsv(resumo, { obraNome: () => "Obra A" });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("2026-07;Obra A;Ana;3;RDO-2026-0001;RDO-2026-0003");
    expect(nomeArquivoResumo("2026-07-01", "2026-07-31")).toBe(
      "rdo-resumo-mensal_2026-07-01_a_2026-07-31.csv",
    );
  });
});
