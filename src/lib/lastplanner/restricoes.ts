/** @module-kind pure */
/**
 * Lógica de restrições do Last Planner.
 * Um pacote está "pronto" quando não há restrições abertas.
 */

export type RestricaoStatus = "aberta" | "resolvida" | "cancelada";
export type RestricaoTipo =
  "projeto" | "material" | "mao_obra" | "equipamento" | "area" | "seguranca" | "contrato" | "outro";

export type Restricao = {
  id: string;
  tipo: RestricaoTipo;
  status: RestricaoStatus;
  prazo?: string | null;
};

export function pacoteEstaPronto(restricoes: Restricao[]): boolean {
  return restricoes.every((r) => r.status !== "aberta");
}

export function restricoesAbertas(restricoes: Restricao[]): Restricao[] {
  return restricoes.filter((r) => r.status === "aberta");
}

export function restricoesVencidas(restricoes: Restricao[], hoje: Date = new Date()): Restricao[] {
  const h = hoje.toISOString().slice(0, 10);
  return restricoes.filter((r) => r.status === "aberta" && r.prazo != null && r.prazo < h);
}

export function restricoesPorTipo(restricoes: Restricao[]): Record<RestricaoTipo, number> {
  const base: Record<RestricaoTipo, number> = {
    projeto: 0,
    material: 0,
    mao_obra: 0,
    equipamento: 0,
    area: 0,
    seguranca: 0,
    contrato: 0,
    outro: 0,
  };
  for (const r of restricoes) {
    if (r.status === "aberta") base[r.tipo] += 1;
  }
  return base;
}

/** Semáforo do pacote para o Lookahead. */
export type Semaforo = "verde" | "amarelo" | "vermelho";

export function semaforoPacote(restricoes: Restricao[], hoje: Date = new Date()): Semaforo {
  if (restricoesVencidas(restricoes, hoje).length > 0) return "vermelho";
  if (restricoesAbertas(restricoes).length > 0) return "amarelo";
  return "verde";
}
