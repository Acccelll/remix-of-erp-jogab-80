/** @module-kind pure */
/**
 * PRO-024 · slice-01 — Status de manutenção preventiva por ativo (frota/patrimônio).
 *
 * Regra pura, sem I/O. Recebe a última manutenção conhecida (com metas
 * `proxima_preventiva_horimetro` / `proxima_preventiva_data`), o odômetro
 * e/ou horímetro correntes do ativo e a data de referência (hoje) e devolve
 * um status agregado + motivos legíveis para exibição em UI.
 *
 * O odômetro (km) é opcional: quando presente na última manutenção via
 * `proxima_preventiva_odometro`, é avaliado da mesma forma que o horímetro.
 * Nenhum campo é obrigatório — se nada estiver informado o retorno é
 * `desconhecido` (não gera falso positivo).
 */

export type StatusPreventiva = "ok" | "proxima" | "vencida" | "desconhecido";

export interface UltimaManutencaoInput {
  data?: string | null; // ISO YYYY-MM-DD
  horimetro?: number | null;
  odometro?: number | null;
  proxima_preventiva_data?: string | null;
  proxima_preventiva_horimetro?: number | null;
  proxima_preventiva_odometro?: number | null;
}

export interface EstadoAtualInput {
  hojeIso: string; // ISO YYYY-MM-DD
  horimetroAtual?: number | null;
  odometroAtual?: number | null;
}

export interface StatusPreventivaConfig {
  /** Margem em horas do horímetro para sinalizar "próxima". */
  margemHorimetro?: number;
  /** Margem em km do odômetro para sinalizar "próxima". */
  margemOdometro?: number;
  /** Margem em dias para sinalizar "próxima". */
  margemDias?: number;
}

export interface StatusPreventivaResult {
  status: StatusPreventiva;
  motivos: string[];
  faltamHoras?: number;
  faltamKm?: number;
  faltamDias?: number;
}

const DEFAULTS: Required<StatusPreventivaConfig> = {
  margemHorimetro: 50,
  margemOdometro: 500,
  margemDias: 15,
};

function diffDias(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

/**
 * Calcula o status de preventiva combinando três dimensões (horímetro,
 * odômetro, data). Precedência: qualquer dimensão vencida → `vencida`;
 * senão qualquer dentro da margem → `proxima`; senão `ok`; se nenhuma meta
 * conhecida → `desconhecido`.
 */
export function statusPreventiva(
  ultima: UltimaManutencaoInput | null | undefined,
  estado: EstadoAtualInput,
  config: StatusPreventivaConfig = {},
): StatusPreventivaResult {
  const cfg = { ...DEFAULTS, ...config };
  const motivos: string[] = [];
  const out: StatusPreventivaResult = { status: "desconhecido", motivos };

  if (!ultima) return out;

  let algumaMetaConhecida = false;
  let vencida = false;
  let proxima = false;

  if (ultima.proxima_preventiva_horimetro != null && estado.horimetroAtual != null) {
    algumaMetaConhecida = true;
    const faltam = ultima.proxima_preventiva_horimetro - estado.horimetroAtual;
    out.faltamHoras = faltam;
    if (faltam <= 0) {
      vencida = true;
      motivos.push(`Horímetro ${Math.abs(faltam)}h além do previsto`);
    } else if (faltam <= cfg.margemHorimetro) {
      proxima = true;
      motivos.push(`Faltam ${faltam}h de horímetro`);
    }
  }

  if (ultima.proxima_preventiva_odometro != null && estado.odometroAtual != null) {
    algumaMetaConhecida = true;
    const faltam = ultima.proxima_preventiva_odometro - estado.odometroAtual;
    out.faltamKm = faltam;
    if (faltam <= 0) {
      vencida = true;
      motivos.push(`Odômetro ${Math.abs(faltam)}km além do previsto`);
    } else if (faltam <= cfg.margemOdometro) {
      proxima = true;
      motivos.push(`Faltam ${faltam}km de odômetro`);
    }
  }

  if (ultima.proxima_preventiva_data && estado.hojeIso) {
    algumaMetaConhecida = true;
    const faltam = diffDias(estado.hojeIso, ultima.proxima_preventiva_data);
    out.faltamDias = faltam;
    if (faltam < 0) {
      vencida = true;
      motivos.push(`Data ${Math.abs(faltam)}d além do previsto`);
    } else if (faltam <= cfg.margemDias) {
      proxima = true;
      motivos.push(`Faltam ${faltam}d para a data prevista`);
    }
  }

  if (!algumaMetaConhecida) return out;
  out.status = vencida ? "vencida" : proxima ? "proxima" : "ok";
  return out;
}
