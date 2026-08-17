// Edge function: gera o AFD (Arquivo Fonte de Dados) a partir da API RHiD.
//
// Separada de `rhid-apuracao` de propósito: a resposta aqui é **texto** de até
// 50.000 linhas por chamada, não JSON. Misturar os dois casos faria a function
// de apuração carregar limites de tamanho e timeout que ela não precisa.
//
// O AFD é o arquivo que a fiscalização exige (Portarias 1510 e 671/MTE) e
// carrega PIS/CPF de toda a base — quem consome restringe o acesso (a aba do
// ERP só aparece para GM) e o arquivo vai para bucket privado.
//
// Docs: https://www.rhid.com.br/v2/swagger.svc/index.html
import { isOriginAllowed } from "../_shared/cors.ts";

const RHID_BASE_URL = "https://www.rhid.com.br/v2/api.svc";
const REQUEST_TIMEOUT_MS = 60_000;
/** Teto declarado pela API por requisição. */
const LIMITE_POR_PAGINA = 50_000;
/** Páginas por chamada — trava de segurança contra laço infinito de NSR. */
const MAX_PAGINAS = 20;

const HEADERS_PADRAO = "authorization, x-client-info, apikey, content-type, x-correlation-id";

function corsHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ?? HEADERS_PADRAO,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
  const origin = req.headers.get("origin");
  if (origin && isOriginAllowed(req)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** NSR é o número sequencial do registro — os 9 dígitos que abrem a linha do AFD. */
function extrairNsr(linha: string): number | null {
  const m = linha.match(/^(\d{9})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** SHA-256 em hex — prova de integridade do que foi arquivado. */
async function sha256(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

class RhidAfd {
  private token: string | null = null;

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
    if (!data?.accessToken) throw new Error("Login RHiD não retornou accessToken");
    this.token = data.accessToken;
  }

  /** Uma página do AFD, como texto puro. */
  private async pagina(
    rota: string,
    params: Record<string, string | number>,
  ): Promise<string> {
    if (!this.token) await this.login();

    const executar = async () => {
      const url = new URL(`${RHID_BASE_URL}${rota}`);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
      return await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    };

    let res = await executar();
    if (res.status === 401) {
      this.token = null;
      await this.login();
      res = await executar();
    }
    if (!res.ok) throw new Error(`RHiD ${rota} respondeu HTTP ${res.status}`);
    return await res.text();
  }

  /**
   * AFD completo do período, concatenando as páginas por NSR.
   * A API devolve no máximo `limit` registros; a próxima página começa no NSR
   * seguinte ao último recebido.
   */
  async gerar(opcoes: {
    idEquipamento: number;
    layout: "1510" | "671";
    coletor: boolean;
    dataIni?: string;
    dataFinal?: string;
    nsrInicial?: number;
  }): Promise<{ conteudo: string; linhas: number; nsrInicial: number | null; nsrFinal: number | null; paginas: number }> {
    const base = opcoes.coletor ? "/report/afd_coletor_marcacao" : "/report/afd";
    const rota = opcoes.layout === "671" ? `${base}/download671` : `${base}/download`;

    const partes: string[] = [];
    let nsr = opcoes.nsrInicial ?? 0;
    let paginas = 0;
    let primeiroNsr: number | null = null;
    let ultimoNsr: number | null = null;

    while (paginas < MAX_PAGINAS) {
      const params: Record<string, string | number> = {
        idEquipamento: opcoes.idEquipamento,
        nsrInicial: nsr,
        limit: LIMITE_POR_PAGINA,
      };
      if (opcoes.dataIni) params.dataIni = opcoes.dataIni;
      if (opcoes.dataFinal) params.dataFinal = opcoes.dataFinal;

      const texto = await this.pagina(rota, params);
      const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (linhas.length === 0) break;

      partes.push(...linhas);
      paginas += 1;

      if (primeiroNsr === null) primeiroNsr = extrairNsr(linhas[0]);
      const nsrFinalPagina = extrairNsr(linhas[linhas.length - 1]);
      if (nsrFinalPagina !== null) ultimoNsr = nsrFinalPagina;

      // Página incompleta significa fim do arquivo; sem NSR legível não há como
      // pedir a próxima sem arriscar repetir a mesma para sempre.
      if (linhas.length < LIMITE_POR_PAGINA || nsrFinalPagina === null) break;
      nsr = nsrFinalPagina + 1;
    }

    const conteudo = partes.join("\r\n");
    return { conteudo, linhas: partes.length, nsrInicial: primeiroNsr, nsrFinal: ultimoNsr, paginas };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(req)) return new Response("origin not allowed", { status: 403 });
    return new Response("ok", { status: 200, headers: corsHeaders(req) });
  }
  if (!isOriginAllowed(req)) return new Response("origin not allowed", { status: 403 });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

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
    const idEquipamento = Number(body?.idEquipamento ?? 0);
    if (!Number.isInteger(idEquipamento) || idEquipamento <= 0) {
      return json(req, { error: "Informe idEquipamento (id do REP na RHiD)" }, 400);
    }

    const layout = body?.layout === "671" ? "671" : "1510";
    const isoValido = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const dataIni = isoValido(body?.dataIni) ? String(body.dataIni) : undefined;
    const dataFinal = isoValido(body?.dataFinal) ? String(body.dataFinal) : undefined;
    if ((dataIni && !dataFinal) || (!dataIni && dataFinal)) {
      return json(req, { error: "Informe dataIni e dataFinal juntos, ou nenhum dos dois" }, 400);
    }
    if (dataIni && dataFinal && dataFinal < dataIni) {
      return json(req, { error: "dataFinal não pode ser anterior a dataIni" }, 400);
    }

    const api = new RhidAfd(email, password, Deno.env.get("RHID_DOMAIN") || undefined);
    const resultado = await api.gerar({
      idEquipamento,
      layout: layout as "1510" | "671",
      coletor: body?.coletor === true,
      dataIni,
      dataFinal,
      nsrInicial: Number.isInteger(body?.nsrInicial) ? Number(body.nsrInicial) : undefined,
    });

    return json(req, {
      ...resultado,
      sha256: await sha256(resultado.conteudo),
      // Avisa quem chamou que o arquivo pode estar truncado pela trava de páginas.
      truncado: resultado.paginas >= MAX_PAGINAS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("rhid-afd error:", message);
    const isTimeout =
      err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    return json(
      req,
      { error: isTimeout ? "Timeout ao gerar o AFD na API RHiD" : message },
      isTimeout ? 504 : 500,
    );
  }
});
