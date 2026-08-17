/** @module-kind pure */
// Parser compartilhado do XML do MS Project.
// Usado pelo importador inicial (/importar) e pelo import semanal de revisões.
import { formatBRL } from "@/lib/core/currency";

export type MppDependency = {
  predecessorUid: string;
  tipo: "FS" | "SS" | "FF" | "SF";
  /** Lag em dias corridos (compat). Para precisão use `lagMinutos`. */
  lagDias: number;
  /** Lag em minutos vindo do MPP (raw/10). */
  lagMinutos: number;
};

export type MppCalendarException = {
  dataInicio: string; // ISO YYYY-MM-DD
  dataFim: string; // ISO YYYY-MM-DD
  trabalha: boolean;
  nome?: string;
};

export type MppCalendar = {
  uid: string;
  nome?: string;
  /** 0=Domingo..6=Sábado (convertido de DayType 1..7 do MS Project). */
  diasUteis: number[];
  horasPorDia: number;
  excecoes: MppCalendarException[];
};

export type MppBaseline = {
  numero: number;
  start?: string;
  finish?: string;
  duracaoHoras?: number;
  custo?: number;
};

export type MppResourceAssignment = {
  resourceUid: string;
  resourceName?: string;
  units?: number;
  work?: string;
};

export type MppTask = {
  uid: string;
  name: string;
  wbs: string;
  outlineLevel: number;
  start?: string;
  finish?: string;
  isSummary: boolean;
  isMilestone: boolean;
  parentUid?: string;
  hasChildren: boolean;
  custo: number;
  percentComplete: number; // 0..100
  predecessors: MppDependency[];
  /** UID do calendário usado por esta tarefa (CalendarUID), se presente. */
  calendarUid?: string;
  /** Localização (LoB) extraída de ExtendedAttribute com alias "localizacao"/"local"/"pavimento". */
  localizacao?: string;
  /** Serviço (LoB) extraído de ExtendedAttribute com alias "servico_lob"/"servico"/"atividade_lob". */
  servicoLob?: string;
  /** Duração em horas trabalhadas (parse de PTxxHxxM). */
  duracaoHoras?: number;
  /** Datas reais executadas (ActualStart/ActualFinish). */
  actualStart?: string;
  actualFinish?: string;
  /** Datas do baseline principal (Baseline Number=0). */
  baselineStart?: string;
  baselineFinish?: string;
  baselineDuracaoHoras?: number;
  baselineCusto?: number;
  /** Todos os baselines encontrados (0..10 no MPP). */
  baselines: MppBaseline[];
  /** Restrições / prazo. */
  constraintTipo?: number;
  constraintData?: string;
  deadline?: string;
  /** Anotações da tarefa. */
  notas?: string;
  prioridade?: number;
  /** Recursos alocados (via Assignments). */
  recursos: MppResourceAssignment[];
};

// MS Project codifica tipos numéricos em PredecessorLink/Type:
// 0=FF, 1=FS, 2=SF, 3=SS  (https://learn.microsoft.com/office-project)
const TIPO_MAP: Record<string, MppDependency["tipo"]> = {
  "0": "FF",
  "1": "FS",
  "2": "SF",
  "3": "SS",
};

// Lag vem em "tenths of minutes" no XML.
// 600 tenths-of-minute = 1h → 14400 = 1 dia
function lagToMinutes(raw?: string): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!isFinite(n) || n === 0) return 0;
  return Math.round(n / 10);
}
function lagToDays(raw?: string): number {
  return Math.round(lagToMinutes(raw) / (60 * 8));
}

/** Converte duração ISO-8601 (PTxHyMzS ou PdxDTyHzM) em horas trabalhadas. */
function durationToHours(raw?: string): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s || s === "PT0H0M0S") return 0;
  // MS Project emite PT<H>H<M>M<S>S; alguns emissores incluem dias (P<d>DT...).
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    s,
  );
  if (!m) return undefined;
  const d = Number(m[1] ?? 0);
  const h = Number(m[2] ?? 0);
  const mm = Number(m[3] ?? 0);
  const ss = Number(m[4] ?? 0);
  const total = d * 8 + h + mm / 60 + ss / 3600;
  return isFinite(total) ? Math.round(total * 100) / 100 : undefined;
}

// DayType do MS Project: 1=Domingo, 2=Segunda ... 7=Sábado → mapeia para getDay() (0..6).
function dayTypeToDow(dt: string | null | undefined): number | null {
  const n = Number(dt);
  if (!isFinite(n) || n < 1 || n > 7) return null;
  return n - 1;
}

function parseCalendars(doc: Document): MppCalendar[] {
  const calNodes = Array.from(doc.querySelectorAll("Project > Calendars > Calendar"));
  return calNodes
    .map((c): MppCalendar | null => {
      const uid = c.querySelector(":scope > UID")?.textContent?.trim();
      if (!uid) return null;
      const nome = c.querySelector(":scope > Name")?.textContent?.trim() ?? undefined;

      const diasUteis: number[] = [];
      let horasPorDia = 8;
      const wdNodes = Array.from(c.querySelectorAll(":scope > WeekDays > WeekDay"));
      for (const wd of wdNodes) {
        const dow = dayTypeToDow(wd.querySelector(":scope > DayType")?.textContent);
        const working = wd.querySelector(":scope > DayWorking")?.textContent?.trim() === "1";
        if (dow !== null && working) diasUteis.push(dow);
        // Tenta inferir horasPorDia a partir do primeiro WorkingTime
        const wts = wd.querySelectorAll(":scope > WorkingTimes > WorkingTime");
        if (working && wts.length > 0) {
          let totMin = 0;
          for (const wt of Array.from(wts)) {
            const from = wt.querySelector(":scope > FromTime")?.textContent?.trim();
            const to = wt.querySelector(":scope > ToTime")?.textContent?.trim();
            if (from && to) {
              const [fh, fm] = from.split(":").map(Number);
              const [th, tm] = to.split(":").map(Number);
              const diff = th * 60 + tm - (fh * 60 + fm);
              if (diff > 0) totMin += diff;
            }
          }
          if (totMin > 0) horasPorDia = Math.round((totMin / 60) * 100) / 100;
        }
      }

      const excecoes: MppCalendarException[] = Array.from(
        c.querySelectorAll(":scope > Exceptions > Exception"),
      )
        .map((ex) => {
          const di = ex.querySelector(":scope > TimePeriod > FromDate")?.textContent?.trim();
          const df = ex.querySelector(":scope > TimePeriod > ToDate")?.textContent?.trim();
          const trabalha = ex.querySelector(":scope > DayWorking")?.textContent?.trim() === "1";
          const nm = ex.querySelector(":scope > Name")?.textContent?.trim() ?? undefined;
          return {
            dataInicio: (di ?? "").slice(0, 10),
            dataFim: (df ?? "").slice(0, 10),
            trabalha,
            nome: nm,
          };
        })
        .filter((e) => e.dataInicio && e.dataFim);

      return {
        uid,
        nome,
        diasUteis: diasUteis.length > 0 ? diasUteis : [1, 2, 3, 4, 5],
        horasPorDia,
        excecoes,
      };
    })
    .filter((c): c is MppCalendar => c !== null);
}

/**
 * Lê os aliases de ExtendedAttributes definidos no nível do projeto e
 * retorna mapas de FieldID → tipo de campo LoB (localizacao | servico_lob).
 *
 * No MS Project, o usuário pode renomear "Texto1" para "Localizacao" via
 * "Personalizar Campos". Esse alias é exportado como
 *   <ExtendedAttributes><ExtendedAttribute><FieldID>188743731</FieldID><Alias>Localizacao</Alias>...
 * e, dentro de cada <Task>, o valor aparece como
 *   <ExtendedAttribute><FieldID>188743731</FieldID><Value>Pav 03</Value></ExtendedAttribute>.
 */
function parseLobAliases(doc: Document): Map<string, "localizacao" | "servico_lob"> {
  const map = new Map<string, "localizacao" | "servico_lob">();
  const nodes = Array.from(
    doc.querySelectorAll("Project > ExtendedAttributes > ExtendedAttribute"),
  );
  for (const n of nodes) {
    const fid = n.querySelector(":scope > FieldID")?.textContent?.trim();
    const alias = n.querySelector(":scope > Alias")?.textContent?.trim();
    if (!fid || !alias) continue;
    const a = normalizar(alias);
    if (
      a === "localizacao" ||
      a === "local" ||
      a === "pavimento" ||
      a === "andar" ||
      a === "setor lob"
    ) {
      map.set(fid, "localizacao");
    } else if (
      a === "servico lob" ||
      a === "servico" ||
      a === "atividade lob" ||
      a === "servico_lob" ||
      a === "lob"
    ) {
      map.set(fid, "servico_lob");
    }
  }
  return map;
}

export function parseMppXml(xmlText: string): {
  titulo?: string;
  tasks: MppTask[];
  calendars: MppCalendar[];
  calendarUidPadrao?: string;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido");

  const titulo =
    doc.querySelector("Project > Title")?.textContent?.trim() ||
    doc.querySelector("Project > Name")?.textContent?.trim();

  const calendars = parseCalendars(doc);
  const calendarUidPadrao =
    doc.querySelector("Project > CalendarUID")?.textContent?.trim() || calendars[0]?.uid;

  const lobAliases = parseLobAliases(doc);

  const taskNodes = Array.from(doc.querySelectorAll("Project > Tasks > Task"));
  const raw: MppTask[] = taskNodes
    .map((t) => {
      const get = (tag: string) => t.querySelector(`:scope > ${tag}`)?.textContent?.trim();
      const start = get("Start");
      const finish = get("Finish");
      const rawCost = Number(get("Cost") ?? "0");
      const fixedCost = Number(get("FixedCost") ?? "0");
      const custo = (rawCost || fixedCost) / 100;
      const pc = Number(get("PercentComplete") ?? "0");
      const calendarUid = get("CalendarUID");

      const actualStartRaw = get("ActualStart");
      const actualFinishRaw = get("ActualFinish");
      const NA_DATE = "2049-12-31";
      const actualStart =
        actualStartRaw && !actualStartRaw.startsWith(NA_DATE)
          ? actualStartRaw.slice(0, 10)
          : undefined;
      const actualFinish =
        actualFinishRaw && !actualFinishRaw.startsWith(NA_DATE)
          ? actualFinishRaw.slice(0, 10)
          : undefined;

      const duracaoHoras = durationToHours(get("Duration"));

      const deadlineRaw = get("Deadline");
      const deadline =
        deadlineRaw && !deadlineRaw.startsWith(NA_DATE) ? deadlineRaw.slice(0, 10) : undefined;
      const constraintTipoRaw = get("ConstraintType");
      const constraintTipo =
        constraintTipoRaw && constraintTipoRaw !== "" ? Number(constraintTipoRaw) : undefined;
      const constraintDataRaw = get("ConstraintDate");
      const constraintData =
        constraintDataRaw && !constraintDataRaw.startsWith(NA_DATE)
          ? constraintDataRaw.slice(0, 10)
          : undefined;
      const notas = get("Notes") || undefined;
      const prioridadeRaw = get("Priority");
      const prioridade =
        prioridadeRaw && prioridadeRaw !== "" ? Number(prioridadeRaw) : undefined;

      // Baselines (0..10)
      const baselines: MppBaseline[] = Array.from(t.querySelectorAll(":scope > Baseline")).map(
        (b) => {
          const num = Number(b.querySelector(":scope > Number")?.textContent?.trim() ?? "0");
          const bs = b.querySelector(":scope > Start")?.textContent?.trim();
          const bf = b.querySelector(":scope > Finish")?.textContent?.trim();
          const bd = b.querySelector(":scope > Duration")?.textContent?.trim();
          const bc = b.querySelector(":scope > Cost")?.textContent?.trim();
          return {
            numero: isFinite(num) ? num : 0,
            start: bs && !bs.startsWith(NA_DATE) ? bs.slice(0, 10) : undefined,
            finish: bf && !bf.startsWith(NA_DATE) ? bf.slice(0, 10) : undefined,
            duracaoHoras: durationToHours(bd),
            custo: bc ? Number(bc) / 100 : undefined,
          };
        },
      );
      const baseline0 = baselines.find((b) => b.numero === 0);

      let localizacao: string | undefined;
      let servicoLob: string | undefined;
      if (lobAliases.size > 0) {
        const eaNodes = Array.from(t.querySelectorAll(":scope > ExtendedAttribute"));
        for (const ea of eaNodes) {
          const fid = ea.querySelector(":scope > FieldID")?.textContent?.trim();
          const val = ea.querySelector(":scope > Value")?.textContent?.trim();
          if (!fid || !val) continue;
          const kind = lobAliases.get(fid);
          if (kind === "localizacao" && !localizacao) localizacao = val;
          else if (kind === "servico_lob" && !servicoLob) servicoLob = val;
        }
      }

      const predecessors: MppDependency[] = Array.from(
        t.querySelectorAll(":scope > PredecessorLink"),
      )
        .map((pl) => {
          const puid = pl.querySelector(":scope > PredecessorUID")?.textContent?.trim();
          const tipoCode = pl.querySelector(":scope > Type")?.textContent?.trim() ?? "1";
          const lag = pl.querySelector(":scope > LinkLag")?.textContent?.trim();
          if (!puid) return null;
          return {
            predecessorUid: puid,
            tipo: TIPO_MAP[tipoCode] ?? "FS",
            lagDias: lagToDays(lag),
            lagMinutos: lagToMinutes(lag),
          };
        })
        .filter((d): d is MppDependency => d !== null);

      return {
        uid: get("UID") ?? "",
        name: get("Name") ?? "(sem nome)",
        wbs: get("OutlineNumber") ?? "",
        outlineLevel: Number(get("OutlineLevel") ?? "0"),
        start: start ? start.slice(0, 10) : undefined,
        finish: finish ? finish.slice(0, 10) : undefined,
        isSummary: get("Summary") === "1",
        isMilestone: get("Milestone") === "1",
        hasChildren: false,
        custo: isFinite(custo) ? custo : 0,
        percentComplete: isFinite(pc) ? Math.max(0, Math.min(100, pc)) : 0,
        predecessors,
        calendarUid: calendarUid && calendarUid !== "-1" ? calendarUid : undefined,
        localizacao,
        servicoLob,
        duracaoHoras,
        actualStart,
        actualFinish,
        baselineStart: baseline0?.start,
        baselineFinish: baseline0?.finish,
        baselineDuracaoHoras: baseline0?.duracaoHoras,
        baselineCusto: baseline0?.custo,
        baselines,
        constraintTipo,
        constraintData,
        deadline,
        notas,
        prioridade,
        recursos: [],
      } satisfies MppTask;
    })
    .filter((t) => t.outlineLevel > 0 && t.name);

  const stack: MppTask[] = [];
  for (const t of raw) {
    while (stack.length && stack[stack.length - 1].outlineLevel >= t.outlineLevel) stack.pop();
    t.parentUid = stack[stack.length - 1]?.uid;
    stack.push(t);
  }
  const childCount = new Map<string, number>();
  for (const t of raw)
    if (t.parentUid) childCount.set(t.parentUid, (childCount.get(t.parentUid) ?? 0) + 1);
  for (const t of raw) t.hasChildren = (childCount.get(t.uid) ?? 0) > 0;

  // Recursos: mapa uid -> nome
  const resNodes = Array.from(doc.querySelectorAll("Project > Resources > Resource"));
  const resNameByUid = new Map<string, string>();
  for (const r of resNodes) {
    const ruid = r.querySelector(":scope > UID")?.textContent?.trim();
    const rname = r.querySelector(":scope > Name")?.textContent?.trim();
    if (ruid) resNameByUid.set(ruid, rname ?? "");
  }
  // Assignments: agrupa por TaskUID
  const taskByUid = new Map(raw.map((t) => [t.uid, t]));
  const asgNodes = Array.from(doc.querySelectorAll("Project > Assignments > Assignment"));
  for (const a of asgNodes) {
    const tuid = a.querySelector(":scope > TaskUID")?.textContent?.trim();
    const ruid = a.querySelector(":scope > ResourceUID")?.textContent?.trim();
    if (!tuid || !ruid || ruid === "-65535") continue;
    const task = taskByUid.get(tuid);
    if (!task) continue;
    const units = Number(a.querySelector(":scope > Units")?.textContent?.trim() ?? "0");
    const work = a.querySelector(":scope > Work")?.textContent?.trim() ?? undefined;
    task.recursos.push({
      resourceUid: ruid,
      resourceName: resNameByUid.get(ruid),
      units: isFinite(units) ? units : undefined,
      work,
    });
  }

  return { titulo, tasks: raw, calendars, calendarUidPadrao };
}

// Detecta arquivo .mpp binário (OLE Compound Document começa com D0 CF 11 E0).
// Cobre o caso de usuário renomear .mpp para .xml.
export async function isMppBinary(file: File): Promise<boolean> {
  if (/\.mpp$/i.test(file.name)) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
  } catch {
    return false;
  }
}

export function dias(start: string, finish: string): number {
  const a = new Date(start).getTime();
  const b = new Date(finish).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

export function parentChain(t: MppTask, byUid: Map<string, MppTask>): MppTask[] {
  const chain: MppTask[] = [];
  let p = t.parentUid;
  while (p) {
    const pt = byUid.get(p);
    if (!pt) break;
    chain.push(pt);
    p = pt.parentUid;
  }
  return chain.reverse();
}

/** Normaliza string para comparação (case/diacrítico-insensível). */
export function normalizar(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type MppReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { tarefasLidas: number; folhas: number; custoTotal: number; percentualMedio: number };
};

/** Validação simples usada pelo importador semanal. */
export function validateMpp(tasks: MppTask[], valorContrato?: number | null): MppReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const folhas = tasks.filter((t) => !t.hasChildren);
  const folhasComData = folhas.filter((t) => t.start && t.finish);
  const custoTotal = folhas.reduce((a, t) => a + (t.custo || 0), 0);
  const pctMedio = folhas.length
    ? folhas.reduce((a, t) => a + ((t as any).percentComplete || 0), 0) / folhas.length
    : 0;
  if (tasks.length === 0) errors.push("Nenhuma tarefa encontrada no XML.");
  if (folhas.length === 0) errors.push("Nenhuma tarefa-folha (executável) detectada.");
  if (folhas.length > 0 && custoTotal === 0)
    warnings.push("Custo total das folhas é zero — verifique se o XML traz <Cost> ou <FixedCost>.");
  if (folhasComData.length < folhas.length)
    warnings.push(`${folhas.length - folhasComData.length} folha(s) sem datas serão ignoradas.`);
  const semUid = tasks.filter((t) => !t.uid).length;
  if (semUid > 0) errors.push(`${semUid} tarefa(s) sem UID — XML inconsistente.`);
  if (
    valorContrato &&
    valorContrato > 0 &&
    pctMedio > 5 &&
    custoTotal < 0.9 * Number(valorContrato)
  ) {
    warnings.push(
      `Custo total (${formatBRL(custoTotal)}) é menor que 90% do contrato e há avanço médio de ${pctMedio.toFixed(1)}%. Possível custo remanescente — confirme antes de importar.`,
    );
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      tarefasLidas: tasks.length,
      folhas: folhas.length,
      custoTotal,
      percentualMedio: pctMedio,
    },
  };
}
