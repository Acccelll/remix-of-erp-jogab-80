/** @module-kind pure */
import type { TituloCanonicoResumo } from "@/lib/repositories/financeiro-titulos";

export type StatusVisualTitulo = "aberto" | "parcial" | "baixado" | "cancelado" | "vencido";
export type TipoFiltroTitulo = "todos" | "pagar" | "receber";
export type StatusFiltroTitulo = "todos" | StatusVisualTitulo;

export interface FiltrosTitulos {
  busca: string;
  tipo: TipoFiltroTitulo;
  status: StatusFiltroTitulo;
  vencimentoInicial: string;
  vencimentoFinal: string;
}

export interface KpisTitulos {
  pagarAberto: number;
  receberAberto: number;
  vencidosValor: number;
  vencidosQuantidade: number;
  valorBaixado: number;
  quantidade: number;
}

export const FILTROS_TITULOS_VAZIOS: FiltrosTitulos = {
  busca: "",
  tipo: "todos",
  status: "todos",
  vencimentoInicial: "",
  vencimentoFinal: "",
};

export const STATUS_TITULO_LABEL: Record<StatusVisualTitulo, string> = {
  aberto: "Em aberto",
  parcial: "Parcial",
  baixado: "Baixado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

function hojeIsoLocal(data = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function statusVisualTitulo(
  titulo: Pick<TituloCanonicoResumo, "status" | "status_calculado" | "saldo_aberto" | "data_vencimento">,
  hoje = hojeIsoLocal(),
): StatusVisualTitulo {
  const status = titulo.status_calculado ?? titulo.status;
  if (status === "cancelado" || titulo.status === "cancelado") return "cancelado";
  if (status === "baixado" || titulo.saldo_aberto <= 0) return "baixado";
  // Vencimento visual tem precedência sobre "parcial": ainda existe saldo exigível.
  if (titulo.saldo_aberto > 0 && titulo.data_vencimento < hoje) return "vencido";
  if (status === "parcial") return "parcial";
  return "aberto";
}

function normalizarBusca(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filtrarTitulos(
  titulos: TituloCanonicoResumo[],
  filtros: FiltrosTitulos,
  hoje?: string,
): TituloCanonicoResumo[] {
  const busca = normalizarBusca(filtros.busca);

  return titulos.filter((titulo) => {
    if (filtros.tipo !== "todos" && titulo.tipo !== filtros.tipo) return false;
    if (filtros.status !== "todos" && statusVisualTitulo(titulo, hoje) !== filtros.status) {
      return false;
    }
    if (filtros.vencimentoInicial && titulo.data_vencimento < filtros.vencimentoInicial) return false;
    if (filtros.vencimentoFinal && titulo.data_vencimento > filtros.vencimentoFinal) return false;

    if (busca) {
      const haystack = normalizarBusca(
        [
          titulo.numero_documento,
          titulo.tipo_documento,
          titulo.nome,
          titulo.nome_fantasia,
          titulo.cnpj_cpf,
          titulo.historico,
          titulo.origem_ref,
        ].join(" "),
      );
      if (!haystack.includes(busca)) return false;
    }

    return true;
  });
}

export function calcularKpisTitulos(
  titulos: TituloCanonicoResumo[],
  hoje?: string,
): KpisTitulos {
  const inicial: KpisTitulos = {
    pagarAberto: 0,
    receberAberto: 0,
    vencidosValor: 0,
    vencidosQuantidade: 0,
    valorBaixado: 0,
    quantidade: 0,
  };

  return titulos.reduce<KpisTitulos>((acc, titulo) => {
    const status = statusVisualTitulo(titulo, hoje);
    const emAberto = status !== "baixado" && status !== "cancelado";
    if (emAberto && titulo.tipo === "pagar") acc.pagarAberto += titulo.saldo_aberto;
    if (emAberto && titulo.tipo === "receber") acc.receberAberto += titulo.saldo_aberto;
    if (status === "vencido") {
      acc.vencidosValor += titulo.saldo_aberto;
      acc.vencidosQuantidade += 1;
    }
    acc.valorBaixado += titulo.valor_baixado;
    acc.quantidade += 1;
    return acc;
  }, inicial);
}

export function temFiltrosTitulosAtivos(filtros: FiltrosTitulos): boolean {
  return (
    filtros.busca.trim() !== "" ||
    filtros.tipo !== "todos" ||
    filtros.status !== "todos" ||
    filtros.vencimentoInicial !== "" ||
    filtros.vencimentoFinal !== ""
  );
}

export function documentoTitulo(titulo: Pick<TituloCanonicoResumo, "numero_documento" | "id">): string {
  return titulo.numero_documento?.trim() || `ERP-${titulo.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
