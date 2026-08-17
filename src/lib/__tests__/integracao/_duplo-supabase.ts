/**
 * Dublê do cliente Supabase para os testes de contrato dos repositories.
 *
 * Grava a cadeia de chamadas (`from().select().eq()...`) sem tocar em banco,
 * para os testes afirmarem tabela, colunas, filtros e ordem.
 *
 * A cadeia é um Proxy, e não um objeto com uma lista de métodos conhecidos.
 * Com lista, um método novo em produção — `.neq()`, `.range()` — não existia no
 * dublê, e a chamada estourava com "não é uma função": uma falha que não diz
 * nada sobre o que mudou e ainda aponta para o arquivo errado. Aconteceu, e
 * como o dublê estava copiado em treze arquivos, as listas derivaram entre si.
 *
 * O que sobra de rede contra método inexistente é a checagem de tipo: os
 * repositories estão em `src/lib/**`, coberto em modo estrito pelo
 * `tsconfig.qc001.json`, e a CI roda `bun run typecheck`. Um método que não
 * existe no supabase-js reprova lá — mais cedo e com mensagem melhor.
 */

// `count` entra porque consultas com `{ count: "exact", head: true }` devolvem
// a contagem ao lado de data/error, e há contratos que afirmam isso.
export type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
export type Recorded = { table: string; ops: Array<{ op: string; args: unknown[] }> };

/** Uma entrada por `from()`, na ordem em que o código foi ao banco. */
export const recorded: Recorded[] = [];

let fila: QueryResult[] = [];
let padrao: QueryResult = { data: [], error: null };

const proximoResultado = () => (fila.length ? fila.shift()! : padrao);

/** Zera o gravador e define a resposta padrão das consultas. */
export function reset(resultado: QueryResult = { data: [], error: null }) {
  recorded.length = 0;
  fila = [];
  padrao = resultado;
}

/**
 * Respostas em sequência, para exercitar quem vai ao banco mais de uma vez —
 * paginação, por exemplo. Esgotada a fila, volta a valer a resposta padrão.
 */
export function enfileirar(...resultados: QueryResult[]) {
  fila.push(...resultados);
}

function cadeia(rec: Recorded) {
  const alvo = {
    // O PostgREST devolve um thenable, não uma Promise: quem consome faz
    // `await`, e é este `then` que entrega o resultado.
    then(onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) {
      return Promise.resolve(proximoResultado()).then(onOk, onErr);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: any = new Proxy(alvo, {
    get(destino, prop) {
      // `then` tem de ser a função de verdade. Devolvê-lo como método gravado
      // faria o `await` receber o próprio proxy de volta e tentar resolver de
      // novo, sem fim.
      if (prop === "then") return destino.then;
      // Símbolo é sondagem de runtime (Symbol.toStringTag, util.inspect, o
      // `expect` do vitest), nunca método do PostgREST.
      if (typeof prop === "symbol") return undefined;
      return (...args: unknown[]) => {
        rec.ops.push({ op: String(prop), args });
        return proxy;
      };
    },
  });

  return proxy;
}

/** Entra no lugar de `@/integrations/supabase/client`. */
export const supabaseFalso = {
  from(table: string) {
    const rec: Recorded = { table, ops: [] };
    recorded.push(rec);
    return cadeia(rec);
  },
};
