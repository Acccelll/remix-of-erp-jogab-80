// Edge function: consulta CNPJ na BrasilAPI a partir do backend,
// evitando bloqueio de CORS e rate limit por IP do navegador do cliente.
// https://brasilapi.com.br/docs#tag/CNPJ

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { cnpj } = await req.json().catch(() => ({}));
    const digits = onlyDigits(typeof cnpj === "string" ? cnpj : "");
    if (digits.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SEC-006 slice-02: timeout explícito para não estourar limite da edge function
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (res.status === 404) {
      return new Response(JSON.stringify({ error: "CNPJ não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "Muitas consultas à BrasilAPI, tente novamente em instantes" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Falha ao consultar a BrasilAPI" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(
      JSON.stringify({
        cnpj: data.cnpj ?? digits,
        razao_social: data.razao_social ?? "",
        nome_fantasia: data.nome_fantasia ?? "",
        logradouro: data.logradouro ?? "",
        numero: data.numero ?? "",
        bairro: data.bairro ?? "",
        municipio: data.municipio ?? "",
        uf: data.uf ?? "",
        cep: data.cep ?? "",
        email: data.email ?? "",
        ddd_telefone_1: data.ddd_telefone_1 ?? "",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cnpj-lookup error:", message);
    const isTimeout =
      err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    return new Response(
      JSON.stringify({ error: isTimeout ? "Timeout ao consultar a BrasilAPI" : message }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
