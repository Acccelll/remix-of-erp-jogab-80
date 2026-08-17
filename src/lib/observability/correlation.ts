/** @module-kind pure */
/**
 * Correlação de eventos — OPS-003.slice-01
 *
 * Gera e propaga um `correlationId` (id curto, url-safe) que atravessa
 * uma unidade lógica de trabalho (ex.: clique do usuário → chamada à
 * API → edge function → log). É deliberadamente síncrono e sem
 * dependências, para ser importável de qualquer camada.
 *
 * Modelo:
 * - `newCorrelationId()`  cria um novo id.
 * - `withCorrelation(id, fn)` roda `fn` com um id "corrente"; ids
 *   aninhados empilham/desempilham em ordem LIFO.
 * - `getCorrelationId()` devolve o id corrente ou `undefined`.
 *
 * Sem AsyncLocalStorage (não disponível no browser). Para trabalho
 * assíncrono, capture o id no início e passe-o explicitamente adiante.
 */

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomByte(): number {
  const g = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (g && typeof g.getRandomValues === "function") {
    const buf = new Uint8Array(1);
    g.getRandomValues(buf);
    return buf[0];
  }
  // Fallback determinístico-fraco apenas para ambientes sem WebCrypto
  // (não usar para segurança — só correlação).
  return Math.floor(Math.random() * 256);
}

export function newCorrelationId(prefix = "cor"): string {
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += ALPHABET[randomByte() % ALPHABET.length];
  }
  return `${prefix}_${out}`;
}

const stack: string[] = [];

export function getCorrelationId(): string | undefined {
  return stack.length > 0 ? stack[stack.length - 1] : undefined;
}

export function withCorrelation<T>(id: string, fn: () => T): T {
  stack.push(id);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

/** Uso em testes / reset explícito. */
export function __resetCorrelationForTests(): void {
  stack.length = 0;
}
