/** @module-kind pure */
import * as XLSX from "xlsx";
import { format } from "date-fns";

type AnyObj = Record<string, any>;

export function exportObraToExcel(opts: {
  obra: AnyObj;
  medicoes: AnyObj[];
  itensMedicao: AnyObj[];
  nfs: AnyObj[];
  recebimentos: AnyObj[];
  crono: AnyObj[];
}) {
  const { obra, medicoes, itensMedicao, nfs, recebimentos, crono } = opts;

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([
      {
        Código: obra.codigo,
        Nome: obra.nome,
        Cliente: obra.clientes?.nome ?? "",
        Status: obra.status,
        "Valor contrato": Number(obra.valor_contrato || 0),
        "Data início": obra.data_inicio ?? "",
        "Data fim": obra.data_fim ?? "",
        "Previsão término": obra.data_previsao_termino ?? "",
      },
    ]),
    "Obra",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      crono.map((c) => ({
        Ordem: c.ordem,
        Descrição: c.descricao,
        Início: c.data_inicio,
        Fim: c.data_fim,
        "Custo baseline": Number(c.custo_baseline ?? c.custo ?? 0),
        Custo: Number(c.custo ?? 0),
        "% Previsto": Number(c.percentual_previsto ?? 0),
        "% Realizado": Number(c.percentual_realizado ?? 0),
      })),
    ),
    "Cronograma",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      medicoes.map((m) => ({
        Número: m.numero,
        "Data corte": m.data_corte,
        Status: m.status,
        Valor: Number(m.valor || 0),
        "%": Number(m.percentual ?? 0),
        Origem: m.arquivo_origem ?? "",
      })),
    ),
    "Medições",
  );

  const cronoMap = new Map(crono.map((c) => [c.id, c]));
  const medMap = new Map(medicoes.map((m) => [m.id, m]));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      itensMedicao.map((im) => {
        const m = medMap.get(im.medicao_id);
        const c = cronoMap.get(im.cronograma_item_id);
        return {
          Medição: m?.numero ?? "",
          "Data corte": m?.data_corte ?? "",
          Item: c?.descricao ?? im.bms_descricao ?? "",
          "% Anterior": Number(im.percentual_anterior || 0),
          "% Atual": Number(im.percentual_atual || 0),
          "Valor anterior": Number(im.valor_anterior || 0),
          "Valor atual": Number(im.valor_atual || 0),
        };
      }),
    ),
    "Itens medição",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      nfs.map((n) => ({
        Número: n.numero,
        Emissão: n.data_emissao,
        Vencimento: n.data_vencimento,
        Competência: n.competencia,
        Valor: Number(n.valor || 0),
        Material: Number(n.valor_material || 0),
        Serviços: Number(n.valor_servicos || 0),
        INSS: Number(n.inss_retido || 0),
        ISS: Number(n.iss_retido || 0),
        CBS: Number(n.retencao_cbs || 0),
        IBS: Number(n.retencao_ibs || 0),
        "Outras retenções": Number(n.outras_retencoes || 0),
        Líquido: Number(n.valor_liquido || 0),
        Status: n.status,
      })),
    ),
    "Notas fiscais",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      recebimentos.map((r) => ({
        "Data prevista": r.data_prevista,
        "Valor previsto": Number(r.valor_previsto || 0),
        "Data recebimento": r.data_recebimento ?? "",
        "Valor recebido": r.valor_recebido != null ? Number(r.valor_recebido) : "",
        Status: r.status,
        Origem: r.origem,
      })),
    ),
    "Recebimentos",
  );

  const fname = `obra_${obra.codigo}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
  XLSX.writeFile(wb, fname);
}
