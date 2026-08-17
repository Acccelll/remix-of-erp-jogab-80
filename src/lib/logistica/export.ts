/**
 * Exportação (CSV/PDF) do resultado da Logística de Colaboradores.
 * Cobre tanto a visão por obra (déficits + candidatos) quanto a
 * visão inversa (colaborador → obras mais próximas).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatarDistancia, type CandidatoMobilizacao, type DeficitFuncao } from "./equipes";
import type { PontoColaborador, PontoObra } from "@/hooks/rh/useLogisticaPontos";
import type { ObraProxima } from "@/components/rh/logistica/PainelOtimizacao";

function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

export interface ExportPorObraInput {
  obra: PontoObra;
  deficits: DeficitFuncao[];
  candidatos: CandidatoMobilizacao[];
  raioKm: number;
}

export interface ExportInversoInput {
  colaborador: PontoColaborador;
  obras: ObraProxima[];
}

function linhasPorObra({ obra, deficits, candidatos, raioKm }: ExportPorObraInput) {
  const meta: (string | number)[][] = [
    ["Obra", obra.obra.nome],
    ["Local", obra.rotuloLocal ?? ""],
    ["Raio (km)", raioKm > 0 ? raioKm : "sem limite"],
    [],
  ];
  const defs: (string | number)[][] = [
    ["Déficit por função"],
    ["Função", "Atual", "Previsto", "Déficit"],
    ...deficits.map((d) => [d.funcao, d.atual, d.previsto, d.deficit]),
    [],
  ];
  const cand: (string | number)[][] = [
    ["Candidatos mais próximos"],
    ["Colaborador", "Função", "Distância", "Motivo"],
    ...candidatos.map((c) => [
      c.colaborador.nome,
      c.colaborador.funcao ?? "",
      c.distanciaKm === null ? "—" : formatarDistancia(c.distanciaKm),
      c.motivo,
    ]),
  ];
  return { meta, defs, cand };
}

function linhasInverso({ colaborador, obras }: ExportInversoInput) {
  const meta: (string | number)[][] = [
    ["Colaborador", colaborador.colaborador.nome],
    ["Função", colaborador.colaborador.funcao ?? ""],
    ["Local", colaborador.rotuloLocal ?? ""],
    [],
  ];
  const lista: (string | number)[][] = [
    ["Obras priorizadas"],
    ["Obra", "Distância", "Déficit da função", "Déficit total"],
    ...obras.map((o) => [
      o.ponto.obra.nome,
      o.distanciaKm === null ? "—" : formatarDistancia(o.distanciaKm),
      o.deficitFuncao,
      o.deficitTotal,
    ]),
  ];
  return { meta, lista };
}

export function exportarCsvPorObra(input: ExportPorObraInput) {
  const { meta, defs, cand } = linhasPorObra(input);
  const csv = toCsv([...meta, ...defs, [], ...cand]);
  baixar(
    `logistica_${input.obra.obra.nome.replace(/\s+/g, "_")}.csv`,
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportarCsvInverso(input: ExportInversoInput) {
  const { meta, lista } = linhasInverso(input);
  const csv = toCsv([...meta, ...lista]);
  baixar(
    `logistica_${input.colaborador.colaborador.nome.replace(/\s+/g, "_")}.csv`,
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportarPdfPorObra(input: ExportPorObraInput) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Logística — " + input.obra.obra.nome, 14, 16);
  doc.setFontSize(10);
  doc.text(
    `Local: ${input.obra.rotuloLocal ?? "—"}   Raio: ${
      input.raioKm > 0 ? input.raioKm + " km" : "sem limite"
    }`,
    14,
    22,
  );

  autoTable(doc, {
    startY: 28,
    head: [["Função", "Atual", "Previsto", "Déficit"]],
    body: input.deficits.map((d) => [d.funcao, d.atual, d.previsto, d.deficit]),
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  autoTable(doc, {
    head: [["Colaborador", "Função", "Distância", "Motivo"]],
    body: input.candidatos.map((c) => [
      c.colaborador.nome,
      c.colaborador.funcao ?? "",
      c.distanciaKm === null ? "—" : formatarDistancia(c.distanciaKm),
      c.motivo,
    ]),
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  doc.save(`logistica_${input.obra.obra.nome.replace(/\s+/g, "_")}.pdf`);
}

export function exportarPdfInverso(input: ExportInversoInput) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Logística — " + input.colaborador.colaborador.nome, 14, 16);
  doc.setFontSize(10);
  doc.text(
    `Função: ${input.colaborador.colaborador.funcao ?? "—"}   Local: ${
      input.colaborador.rotuloLocal ?? "—"
    }`,
    14,
    22,
  );

  autoTable(doc, {
    startY: 28,
    head: [["Obra", "Distância", "Déficit da função", "Déficit total"]],
    body: input.obras.map((o) => [
      o.ponto.obra.nome,
      o.distanciaKm === null ? "—" : formatarDistancia(o.distanciaKm),
      o.deficitFuncao,
      o.deficitTotal,
    ]),
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 9 },
  });

  doc.save(`logistica_${input.colaborador.colaborador.nome.replace(/\s+/g, "_")}.pdf`);
}
