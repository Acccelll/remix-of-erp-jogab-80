// Edge function: consulta a API RHiD (ControlID) a partir do backend.
//
// Motivos para não chamar a RHiD direto do navegador:
//  - a API não emite CORS para a origem do ERP;
//  - as credenciais ficariam expostas no cliente.
//
// As credenciais vivem apenas nos secrets `RHID_EMAIL` / `RHID_PASSWORD`.
// Docs: https://www.rhid.com.br/v2/swagger.svc/index.html

// Reaproveita a allowlist de origem do SEC-003, mas monta os cabeçalhos CORS aqui:
// o ERP injeta `X-Correlation-Id` em toda chamada ao Supabase
// (src/lib/observability/fetch-interceptor.ts) e uma lista fixa de
// Access-Control-Allow-Headers quebra o preflight a cada header novo que o app
// passe a enviar. Refletir o que o browser pediu evita esse acoplamento.
import { isOriginAllowed } from "../_shared/cors.ts";

const RHID_BASE_URL = "https://www.rhid.com.br/v2/api.svc";
const REQUEST_TIMEOUT_MS = 20_000;
/** Regra da API: o intervalo dataIni↔dataFinal não pode exceder 90 dias. */
const MAX_JANELA_DIAS = 90;
/** Requisições simultâneas contra a RHiD (evita 429 e estouro de tempo da function). */
const CONCORRENCIA = 5;

interface RhidPessoa {
  idPerson: number;
  name: string;
  cpf: string | null;
  pis: string | null;
  registration: string | null;
  departamento: string | null;
  /** Campos que /person já devolve e alimentam a Conciliação de Cadastro. */
  status: number | null;
  numberOfTemplates: number | null;
  linkedDeviceIds: number[];
}

/** Usado quando o browser não declara `Access-Control-Request-Headers`. */
const HEADERS_PADRAO = "authorization, x-client-info, apikey, content-type, x-correlation-id";

/**
 * Cabeçalhos CORS da resposta. `Access-Control-Allow-Headers` devolve exatamente
 * o que o preflight pediu; `Vary` impede que um cliente receba do cache a
 * permissão emitida para outro conjunto de headers.
 */
function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ?? HEADERS_PADRAO,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
  const origin = req.headers.get("origin");
  // Origem fora da allowlist não recebe Allow-Origin — o browser rejeita a resposta.
  if (origin && isOriginAllowed(req)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!isOriginAllowed(req)) return new Response("origin not allowed", { status: 403 });
  return new Response("ok", { status: 200, headers: corsHeaders(req) });
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** A API serializa alguns retornos como string JSON — normaliza para objeto. */
function parseTalvezString(payload: unknown): unknown {
  if (typeof payload !== "string") return payload;
  const s = payload.trim();
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

/** Array embutido no valor, quando ele é array ou string JSON de array. */
function comoArray(valor: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(valor)) return valor as Record<string, unknown>[];
  if (typeof valor === "string") {
    const s = valor.trim();
    if (!s.startsWith("[")) return null;
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function comoLista(payload: unknown): Record<string, unknown>[] {
  const parsed = parseTalvezString(payload);
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    // Envelopes conhecidos — a RHiD usa { records, totalRecords } em /person, /department etc.
    for (const chave of ["records", "data", "list", "items", "result"]) {
      const inner = comoArray(obj[chave]);
      if (inner) return inner;
    }
    // Envelope desconhecido: usa a primeira propriedade que for (ou contiver) um array.
    for (const valor of Object.values(obj)) {
      const inner = comoArray(valor);
      if (inner) return inner;
    }
    return [obj];
  }
  return [];
}

function soDigitos(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\D/g, "");
  // A API devolve 0 quando o campo não está preenchido.
  return s && Number(s) !== 0 ? s : null;
}

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

/** Divide o período em janelas de no máximo 90 dias (limite da API). */
export function fatiarPeriodo(
  dataIni: string,
  dataFinal: string,
): Array<{ dataIni: string; dataFinal: string }> {
  const inicio = new Date(`${dataIni}T00:00:00Z`);
  const fim = new Date(`${dataFinal}T00:00:00Z`);
  if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || inicio > fim) return [];

  const janelas: Array<{ dataIni: string; dataFinal: string }> = [];
  let cursor = inicio;
  while (cursor <= fim) {
    const limite = new Date(cursor);
    limite.setUTCDate(limite.getUTCDate() + MAX_JANELA_DIAS - 1);
    const janelaFim = limite > fim ? fim : limite;
    janelas.push({
      dataIni: cursor.toISOString().slice(0, 10),
      dataFinal: janelaFim.toISOString().slice(0, 10),
    });
    cursor = new Date(janelaFim);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return janelas;
}

/** Executa `tarefas` com no máximo `limite` requisições simultâneas. */
async function comLimite<T, R>(
  itens: T[],
  limite: number,
  tarefa: (item: T) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(itens.length);
  let proximo = 0;
  const workers = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const idx = proximo++;
      resultados[idx] = await tarefa(itens[idx]);
    }
  });
  await Promise.all(workers);
  return resultados;
}

/** Resumo seguro de um payload — nunca ecoa valores sensíveis. */
function resumirPayload(bruto: unknown) {
  const parsed = parseTalvezString(bruto);
  const lista = comoLista(bruto);
  const primeiro = lista[0];
  return {
    tipoBruto: typeof bruto,
    ehArrayAposParse: Array.isArray(parsed),
    chavesTopo:
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.keys(parsed as Record<string, unknown>)
        : null,
    itensDetectados: lista.length,
    chavesPrimeiroItem: primeiro ? Object.keys(primeiro) : null,
    amostraPrimeiroItem: primeiro
      ? Object.fromEntries(
          Object.entries(primeiro).map(([k, v]) => [
            k,
            /cpf|pis|password|senha|template/i.test(k) ? "***" : v,
          ]),
        )
      : null,
  };
}

class RhidApi {
  private token: string | null = null;
  /** Resumo do último login, sem segredos — usado pelo modo debug. */
  loginResumo: Record<string, unknown> | null = null;

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly domain?: string,
  ) {}

  async login(): Promise<void> {
    const body: Record<string, unknown> = {
      email: this.email,
      password: this.password,
      system: "rhid",
    };
    if (this.domain) body.domain = this.domain;

    const res = await fetch(`${RHID_BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Nunca ecoar o corpo: pode conter eco das credenciais.
      throw new Error(
        res.status === 400
          ? "Credenciais RHiD inválidas (verifique os secrets RHID_EMAIL/RHID_PASSWORD)"
          : `Falha no login RHiD (HTTP ${res.status})`,
      );
    }

    const data = await res.json();
    this.loginResumo = {
      expiredPassword: data?.expiredPassword ?? null,
      isPerson: data?.isPerson ?? null,
      code: data?.code ?? null,
      error: data?.error ?? null,
      dominioUsado: this.domain ?? null,
      listCustomer: Array.isArray(data?.listCustomer)
        ? data.listCustomer.map((c: Record<string, unknown>) => ({
            id: c?.id ?? null,
            domain: c?.domain ?? null,
            name: c?.name ?? null,
          }))
        : [],
    };
    if (!data?.accessToken) throw new Error("Login RHiD não retornou accessToken");
    this.token = data.accessToken;
  }

  /** Diagnóstico: formato bruto dos cadastros, sem expor credenciais. */
  async diagnostico(): Promise<Record<string, unknown>> {
    await this.login();
    const [pessoas, departamentos, empresas] = await Promise.all([
      this.get("/person").catch((e) => ({ __erro: String(e?.message ?? e) })),
      this.get("/department").catch((e) => ({ __erro: String(e?.message ?? e) })),
      this.get("/company").catch((e) => ({ __erro: String(e?.message ?? e) })),
    ]);
    return {
      login: this.loginResumo,
      person: resumirPayload(pessoas),
      department: resumirPayload(departamentos),
      company: resumirPayload(empresas),
      pessoasMapeadas: (await this.listarPessoas().catch(() => [])).length,
    };
  }

  /** GET autenticado; em 401 refaz o login uma única vez e repete. */
  private async get(endpoint: string, params?: Record<string, string | number>): Promise<unknown> {
    if (!this.token) await this.login();

    const executar = async () => {
      const url = new URL(`${RHID_BASE_URL}${endpoint}`);
      for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, String(v));
      return await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    };

    let res = await executar();
    if (res.status === 401) {
      this.token = null;
      await this.login();
      res = await executar();
    }
    if (!res.ok) throw new Error(`RHiD ${endpoint} respondeu HTTP ${res.status}`);

    const bruto = await res.text();
    try {
      return JSON.parse(bruto);
    } catch {
      return bruto;
    }
  }

  /** Cadastro de pessoas já com o nome do departamento resolvido. */
  async listarPessoas(): Promise<RhidPessoa[]> {
    const [pessoasRaw, deptosRaw] = await Promise.all([
      this.get("/person"),
      this.get("/department").catch(() => []),
    ]);

    const deptoPorId = new Map<string, string>();
    for (const d of comoLista(deptosRaw)) {
      const id = texto(d.id);
      const nome = texto(d.name);
      if (id && nome) deptoPorId.set(id, nome);
    }

    const numero = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    return comoLista(pessoasRaw)
      .map((p) => ({
        idPerson: Number(p.id ?? p.idPerson ?? 0),
        name: texto(p.name) ?? "",
        cpf: soDigitos(p.cpf),
        pis: soDigitos(p.pis),
        registration: texto(p.registration),
        departamento: deptoPorId.get(String(p.idDepartment ?? "")) ?? null,
        // Descartados até então: dizem quem está ativo na catraca, quem não tem
        // biometria coletada e quem não está vinculado a nenhum REP.
        status: numero(p.status),
        numberOfTemplates: numero(p.numberOfTemplates),
        linkedDeviceIds: Array.isArray(p.linkedDeviceIds)
          ? (p.linkedDeviceIds as unknown[]).map(Number).filter(Number.isFinite)
          : [],
      }))
      .filter((p) => p.idPerson > 0 && p.name);
  }

  /** Apuração diária (motor ACJEF) de uma pessoa, já concatenando as janelas de 90 dias. */
  async apuracao(
    idPerson: number,
    dataIni: string,
    dataFinal: string,
  ): Promise<Record<string, unknown>[]> {
    const janelas = fatiarPeriodo(dataIni, dataFinal);
    const dias: Record<string, unknown>[] = [];
    for (const janela of janelas) {
      const payload = await this.get("/apuracao_ponto", { idPerson, ...janela });
      dias.push(...comoLista(payload));
    }
    return dias;
  }

  /** POST autenticado; mesma política de 401 do `get`. */
  private async post(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.token) await this.login();

    const executar = () =>
      fetch(`${RHID_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

    let res = await executar();
    if (res.status === 401) {
      this.token = null;
      await this.login();
      res = await executar();
    }
    if (!res.ok) throw new Error(`RHiD ${endpoint} respondeu HTTP ${res.status}`);

    const bruto = await res.text();
    try {
      return JSON.parse(bruto);
    } catch {
      return bruto;
    }
  }

  /**
   * Justificativas do período. É POST apesar de ser leitura — os filtros vão no
   * corpo. Mesmo teto de 90 dias da apuração, então reusa `fatiarPeriodo`.
   */
  async justificativas(dataIni: string, dataFinal: string): Promise<Record<string, unknown>[]> {
    const registros: Record<string, unknown>[] = [];
    for (const janela of fatiarPeriodo(dataIni, dataFinal)) {
      const payload = await this.post("/justifications", {
        ini: janela.dataIni,
        fim: janela.dataFinal,
      });
      registros.push(...comoLista(payload));
    }
    return registros;
  }

  /** Tipos de justificativa — trazem os limites (qtdMensal, qtdAnual…) e as flags de folha. */
  async tiposDeJustificativa(): Promise<Record<string, unknown>[]> {
    return comoLista(await this.get("/justificationstype"));
  }

  /** Equipamentos REP: última conexão/sincronização, biometrias e status do papel. */
  async dispositivos(): Promise<Record<string, unknown>[]> {
    return comoLista(await this.get("/device"));
  }
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (!isOriginAllowed(req)) {
    return new Response("origin not allowed", { status: 403 });
  }
  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  const email = Deno.env.get("RHID_EMAIL");
  const password = Deno.env.get("RHID_PASSWORD");
  if (!email || !password) {
    return json(
      req,
      { error: "Integração RHiD não configurada: defina os secrets RHID_EMAIL e RHID_PASSWORD" },
      500,
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { dataIni, dataFinal, idPersons, debug, acao } = body ?? {};

    const domain = Deno.env.get("RHID_DOMAIN") || undefined;

    // Modo diagnóstico: inspeciona o formato bruto dos cadastros (sem segredos).
    if (debug === true) {
      const apiDebug = new RhidApi(email, password, domain);
      return json(req, { debug: await apiDebug.diagnostico() });
    }

    const isoValido = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

    // Domínios que não dependem de período: login e CORS ficam nesta function,
    // em vez de uma function por endpoint da RHiD.
    if (acao === "tipos-justificativa") {
      const apiTipos = new RhidApi(email, password, domain);
      return json(req, { tipos: await apiTipos.tiposDeJustificativa() });
    }
    if (acao === "devices") {
      const apiDevices = new RhidApi(email, password, domain);
      return json(req, { dispositivos: await apiDevices.dispositivos() });
    }
    if (acao === "justificativas") {
      if (!isoValido(dataIni) || !isoValido(dataFinal)) {
        return json(req, { error: "Informe dataIni e dataFinal no formato AAAA-MM-DD" }, 400);
      }
      if (dataFinal < dataIni) {
        return json(req, { error: "dataFinal não pode ser anterior a dataIni" }, 400);
      }
      const apiJust = new RhidApi(email, password, domain);
      return json(req, { justificativas: await apiJust.justificativas(dataIni, dataFinal) });
    }

    if (!isoValido(dataIni) || !isoValido(dataFinal)) {
      return json(req, { error: "Informe dataIni e dataFinal no formato AAAA-MM-DD" }, 400);
    }
    if (dataFinal < dataIni) {
      return json(req, { error: "dataFinal não pode ser anterior a dataIni" }, 400);
    }

    const api = new RhidApi(email, password, domain);

    // Sem idPersons → devolve só o cadastro, para o ERP casar por CPF e montar os lotes.
    if (!Array.isArray(idPersons) || idPersons.length === 0) {
      const pessoas = await api.listarPessoas();
      return json(req, {
        pessoas,
        dias: [],
        amostraBruta: null,
        erros: [],
        diagnostico: pessoas.length === 0 ? api.loginResumo : null,
      });
    }

    const ids = idPersons.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) {
      return json(req, { error: "idPersons não contém nenhum id válido" }, 400);
    }

    // Um login compartilhado por todas as requisições do lote.
    await api.login();

    const erros: Array<{ idPerson: number; error: string }> = [];
    const dias: Record<string, unknown>[] = [];
    let amostraBruta: Record<string, unknown> | null = null;

    const lotes = await comLimite(ids, CONCORRENCIA, async (idPerson) => {
      try {
        return { idPerson, dias: await api.apuracao(idPerson, dataIni, dataFinal) };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        erros.push({ idPerson, error: message });
        return { idPerson, dias: [] as Record<string, unknown>[] };
      }
    });

    for (const lote of lotes) {
      for (const dia of lote.dias) {
        // A apuração nem sempre devolve idPerson (ou devolve 0); sem ele o ERP não
        // consegue casar a linha com o cadastro, então garantimos o id do lote.
        const proprio = Number(dia.idPerson ?? dia.idPessoa ?? 0);
        dias.push(proprio > 0 ? dia : { ...dia, idPerson: lote.idPerson });
        if (!amostraBruta) amostraBruta = dia;
      }
    }

    return json(req, { pessoas: [], dias, amostraBruta, erros });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("rhid-apuracao error:", message);
    const isTimeout =
      err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    return json(
      req,
      { error: isTimeout ? "Timeout ao consultar a API RHiD" : message },
      isTimeout ? 504 : 500,
    );
  }
});
