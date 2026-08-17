/** @module-kind pure */
/**
 * PRO-020.slice-01 — Projeção de despesa recorrente a partir de contratos.
 *
 * Regra desta slice (mínima, sem escrita em Financeiro):
 *  - Contrato "recorrente" = ativo && status ∈ {ativo, suspenso} && valor>0 && inicio válido.
 *  - Cadência assumida: mensal (o `valor` do contrato é tratado como parcela mensal).
 *  - "Meses restantes" conta o mês corrente (inclusive) até `termino` (inclusive),
 *    ou 0 se já encerrado; se sem `termino`, retorna null (indeterminado) e o total
 *    projetado também é null.
 */

export type ContratoRecorrenteInput = {
  valor: number;
  inicio?: string; // ISO ou dd/mm/aaaa
  termino?: string; // ISO ou dd/mm/aaaa (opcional)
  status?: string;
  ativo?: boolean;
};

export type Projecao = {
  elegivel: boolean;
  mensalPrevisto: number;
  mesesRestantes: number | null;
  totalPrevisto: number | null;
};

function parseData(s?: string): Date | null {
  if (!s) return null;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function difMeses(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
}

export function projetarRecorrencia(
  c: ContratoRecorrenteInput,
  hoje: Date = new Date(),
): Projecao {
  const statusOk = c.status !== "encerrado" && c.status !== "rascunho";
  const inicio = parseData(c.inicio);
  const elegivel = !!c.ativo && statusOk && (c.valor ?? 0) > 0 && !!inicio;

  if (!elegivel) {
    return { elegivel: false, mensalPrevisto: 0, mesesRestantes: 0, totalPrevisto: 0 };
  }

  const mensal = c.valor;
  const termino = parseData(c.termino);
  const referencia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  if (!termino) {
    return { elegivel: true, mensalPrevisto: mensal, mesesRestantes: null, totalPrevisto: null };
  }
  const fim = new Date(termino.getFullYear(), termino.getMonth(), 1);
  const meses = Math.max(0, difMeses(referencia, fim));
  return {
    elegivel: true,
    mensalPrevisto: meses > 0 ? mensal : 0,
    mesesRestantes: meses,
    totalPrevisto: mensal * meses,
  };
}

export function projetarLista(
  contratos: ContratoRecorrenteInput[],
  hoje: Date = new Date(),
): { mensalTotal: number; totalPrevisto: number; contratosElegiveis: number } {
  let mensalTotal = 0;
  let totalPrevisto = 0;
  let contratosElegiveis = 0;
  for (const c of contratos) {
    const p = projetarRecorrencia(c, hoje);
    if (!p.elegivel) continue;
    contratosElegiveis += 1;
    mensalTotal += p.mensalPrevisto;
    if (p.totalPrevisto != null) totalPrevisto += p.totalPrevisto;
  }
  return { mensalTotal, totalPrevisto, contratosElegiveis };
}

/**
 * PRO-020.slice-02 — Agregação de recorrência por obra × mês (horizonte configurável).
 *
 * Retorna, para cada mês do horizonte a partir de `hoje` (mês corrente inclusive),
 * o valor mensal previsto por obra (chave `obraAtualId ?? "__sem_obra__"`).
 * Contratos sem `termino` são projetados durante todo o horizonte.
 */
export type ContratoObraInput = ContratoRecorrenteInput & {
  obraAtualId?: string | null;
};

export type LinhaMensalObra = {
  mesISO: string; // YYYY-MM
  porObra: Record<string, number>;
  total: number;
};

export const SEM_OBRA_KEY = "__sem_obra__";

export function projetarPorObraMes(
  contratos: ContratoObraInput[],
  horizonteMeses = 12,
  hoje: Date = new Date(),
): LinhaMensalObra[] {
  const inicioRef = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const linhas: LinhaMensalObra[] = [];

  for (let i = 0; i < horizonteMeses; i++) {
    const mes = new Date(inicioRef.getFullYear(), inicioRef.getMonth() + i, 1);
    const mesISO = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}`;
    const porObra: Record<string, number> = {};
    let total = 0;

    for (const c of contratos) {
      const proj = projetarRecorrencia(c, hoje);
      if (!proj.elegivel) continue;
      const inicio = parseData(c.inicio);
      const termino = parseData(c.termino);
      if (!inicio) continue;
      const iniMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
      if (mes < iniMes) continue;
      if (termino) {
        const fimMes = new Date(termino.getFullYear(), termino.getMonth(), 1);
        if (mes > fimMes) continue;
      }
      const chave = c.obraAtualId ?? SEM_OBRA_KEY;
      porObra[chave] = (porObra[chave] ?? 0) + c.valor;
      total += c.valor;
    }

    linhas.push({ mesISO, porObra, total });
  }

  return linhas;
}

/**
 * PRO-020.slice-05 — Projeção por contrato × mês.
 * Cada linha traz o `id` do contrato e o valor previsto em cada mês do horizonte.
 * Contratos não elegíveis são omitidos.
 */
export type ContratoIdInput = ContratoObraInput & { id: string };

export type LinhaContratoMes = {
  id: string;
  obraAtualId?: string | null;
  porMes: Record<string, number>; // mesISO -> valor
  total: number;
};

export type FiltrosCronogramaContratos = {
  somenteStatusAtivo?: boolean;
  obraAtualId?: string | null;
};

/**
 * PRO-020.slice-06 — Filtros explícitos para contratos incluídos no cronograma.
 * Mantém a elegibilidade financeira em `projetarRecorrencia`; esta função só
 * estreita o conjunto por status operacional e/ou obra.
 */
export function filtrarContratosCronograma<T extends ContratoObraInput>(
  contratos: T[],
  filtros: FiltrosCronogramaContratos = {},
): T[] {
  return contratos.filter((c) => {
    if (filtros.somenteStatusAtivo && c.status !== "ativo") return false;
    if (filtros.obraAtualId === undefined) return true;
    if (filtros.obraAtualId === null) return (c.obraAtualId ?? null) === null;
    return c.obraAtualId === filtros.obraAtualId;
  });
}

export function projetarPorContratoMes(
  contratos: ContratoIdInput[],
  horizonteMeses = 12,
  hoje: Date = new Date(),
): { meses: string[]; linhas: LinhaContratoMes[] } {
  const inicioRef = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const meses: string[] = [];
  for (let i = 0; i < horizonteMeses; i++) {
    const m = new Date(inicioRef.getFullYear(), inicioRef.getMonth() + i, 1);
    meses.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }

  const linhas: LinhaContratoMes[] = [];
  for (const c of contratos) {
    const proj = projetarRecorrencia(c, hoje);
    if (!proj.elegivel) continue;
    const inicio = parseData(c.inicio);
    const termino = parseData(c.termino);
    if (!inicio) continue;
    const iniMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const fimMes = termino
      ? new Date(termino.getFullYear(), termino.getMonth(), 1)
      : null;
    const porMes: Record<string, number> = {};
    let total = 0;
    for (let i = 0; i < horizonteMeses; i++) {
      const m = new Date(inicioRef.getFullYear(), inicioRef.getMonth() + i, 1);
      if (m < iniMes) continue;
      if (fimMes && m > fimMes) continue;
      porMes[meses[i]] = c.valor;
      total += c.valor;
    }
    if (total > 0) {
      linhas.push({ id: c.id, obraAtualId: c.obraAtualId, porMes, total });
    }
  }
  return { meses, linhas };
}


