/** @module-kind io */
/**
 * withDeadline — SEC-006. Envelopa uma Promise arbitrária com um
 * deadline explícito. Se `ms` estourar antes da resolução, rejeita com
 * `DeadlineExceededError` e o log estruturado registra o evento.
 *
 * Uso típico:
 * ```ts
 * await withDeadline(fetchRelatorio(id), 10_000, "relatorio.pdf");
 * ```
 *
 * Diferente de `fetchWithRetry`, é agnóstico ao transporte — serve para
 * chamadas Supabase, RPCs, promises de bibliotecas de terceiros, etc.
 * Não cancela a operação subjacente (JS não permite abortar Promise
 * pura); apenas garante que o chamador não fique bloqueado.
 */
import { logger } from "@/lib/core/logger";

export class DeadlineExceededError extends Error {
  readonly code = "DEADLINE_EXCEEDED" as const;
  constructor(
    public readonly label: string,
    public readonly timeoutMs: number,
  ) {
    super(`Deadline de ${timeoutMs}ms excedido em "${label}"`);
    this.name = "DeadlineExceededError";
  }
}

export function isDeadlineExceeded(e: unknown): e is DeadlineExceededError {
  return e instanceof DeadlineExceededError;
}

export interface DeadlineOptions {
  /** Rótulo para log/erro (ex.: "supabase.obras.list"). Obrigatório em produção. */
  label?: string;
  /** Callback opcional disparado quando o deadline estoura. */
  onTimeout?: () => void;
}

/**
 * Rejeita a promise se `ms` estourar antes da conclusão. Sempre limpa o
 * timer (não vaza handle mesmo em caminho de sucesso).
 */
export function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  labelOrOpts: string | DeadlineOptions = "operation",
): Promise<T> {
  const opts: DeadlineOptions =
    typeof labelOrOpts === "string" ? { label: labelOrOpts } : labelOrOpts;
  const label = opts.label ?? "operation";

  if (!Number.isFinite(ms) || ms <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const err = new DeadlineExceededError(label, ms);
      try {
        logger?.warn?.("deadline_exceeded", { label, timeoutMs: ms });
      } catch {
        /* logger é opcional em testes */
      }
      opts.onTimeout?.();
      reject(err);
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
