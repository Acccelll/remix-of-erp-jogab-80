// SEC-003 (Onda 0) — CORS por allowlist estrita.
//
// Substitui os cabeçalhos inline `Access-Control-Allow-Origin: *` das edge
// functions por uma allowlist controlada. Se a origem não estiver autorizada,
// `Access-Control-Allow-Origin` NÃO é emitido — o browser rejeita a resposta
// e o handler deve devolver 403.
//
// A allowlist é composta por:
//  - hosts padrão confiáveis (localhost + domínios Lovable);
//  - hosts adicionais via env `EDGE_ALLOWED_ORIGINS` (CSV de host ou URL completa).
//
// Nunca emite `Access-Control-Allow-Credentials: true` junto com origem `*`.

const DEFAULT_TRUSTED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "lovable.app",
  "lovableproject.com",
  "lovable.dev",
];

const BASE_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  Vary: "Origin",
};

function allowedList(): string[] {
  const extra = (Deno.env.get("EDGE_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return [...DEFAULT_TRUSTED_HOSTS, ...extra];
}

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // chamadas server-to-server sem Origin
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedList().some((entry) => {
    if (entry.startsWith("http://") || entry.startsWith("https://")) {
      return origin.toLowerCase() === entry;
    }
    return host === entry || host.endsWith(`.${entry}`);
  });
}

/** Cabeçalhos CORS para a requisição — omite Allow-Origin se a origem não é permitida. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (origin && isOriginAllowed(req)) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  return { ...BASE_HEADERS };
}

/** Handler compartilhado para preflight OPTIONS com validação de origem. */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!isOriginAllowed(req)) {
    return new Response("origin not allowed", { status: 403, headers: BASE_HEADERS });
  }
  return new Response("ok", { headers: corsHeadersFor(req) });
}
