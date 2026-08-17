/** @module-kind pure */
// Linha de Balanço (LoB) — engine pura, sem dependências de React/Supabase.
//
// Dada a lista de atividades do cronograma com `servico_lob` (agrupador do
// serviço repetido) e `loc_ordem` (posição da localização repetitiva), produz,
// para cada serviço, a sequência ordenada de pontos (localização × data_inicio)
// e (localização × data_fim) que formam o "trem" de produção da LoB.
//
// Convenções:
//   - Atividades sem `servico_lob` ou sem `loc_ordem` são IGNORADAS (LoB é opt-in).
//   - Pontos por serviço ordenados crescentes por `loc` (depois por `inicio`).
//   - Quando duas atividades caem na mesma `loc` para o mesmo serviço, ambas
//     viram pontos distintos (cliente decide se mescla visualmente).

import { parseISO, isValid } from "date-fns";

export type LobItemInput = {
  id: string;
  servico_lob: string | null;
  loc_ordem: number | null;
  data_inicio: string;
  data_fim: string;
};

export type LobPonto = {
  id: string;
  loc: number;
  inicio: Date;
  fim: Date;
};

export type LobLinha = {
  servico: string;
  pontos: LobPonto[];
};

function parseDate(s: string): Date | null {
  try {
    const d = parseISO(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

export function montarLinhasBalanco(itens: LobItemInput[]): LobLinha[] {
  const porServico = new Map<string, LobPonto[]>();
  for (const it of itens) {
    const servico = (it.servico_lob ?? "").trim();
    if (!servico) continue;
    if (it.loc_ordem == null) continue;
    const inicio = parseDate(it.data_inicio);
    const fim = parseDate(it.data_fim);
    if (!inicio || !fim) continue;
    const arr = porServico.get(servico) ?? [];
    arr.push({ id: it.id, loc: Number(it.loc_ordem), inicio, fim });
    porServico.set(servico, arr);
  }
  const out: LobLinha[] = [];
  for (const [servico, pontos] of porServico) {
    pontos.sort((a, b) => a.loc - b.loc || a.inicio.getTime() - b.inicio.getTime());
    out.push({ servico, pontos });
  }
  // ordena serviços alfabeticamente para estabilidade na UI
  out.sort((a, b) => a.servico.localeCompare(b.servico));
  return out;
}

/** Detecta sobreposições/conflitos de equipe: para o mesmo serviço, pontos cujo intervalo
 * [inicio, fim] se sobrepõe ao do ponto da localização anterior. Útil para destacar
 * cruzamento de equipes na LoB. */
export function detectarSobreposicoes(
  linhas: LobLinha[],
): { servico: string; aId: string; bId: string }[] {
  const out: { servico: string; aId: string; bId: string }[] = [];
  for (const l of linhas) {
    for (let i = 1; i < l.pontos.length; i++) {
      const prev = l.pontos[i - 1];
      const cur = l.pontos[i];
      if (cur.inicio.getTime() < prev.fim.getTime()) {
        out.push({ servico: l.servico, aId: prev.id, bId: cur.id });
      }
    }
  }
  return out;
}
