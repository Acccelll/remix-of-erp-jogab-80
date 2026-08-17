import type { ReactNode } from "react";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Wrapper único para apresentar estados de uma react-query (ou similar):
 * - isLoading → skeleton/spinner padrão
 * - isError   → mensagem com ação de retry
 * - data vazio → empty (se fornecido)
 * - sucesso   → children
 *
 * Padroniza o tratamento em todas as listas para fugir do "spinner mudo".
 */
export interface QueryStateProps<T> {
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  data?: T;
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  /** Conteúdo do skeleton; default = 3 linhas pulsantes. */
  loading?: ReactNode;
  /** Mostrado quando isEmpty(data) === true. */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function QueryState<T>({
  isLoading,
  isError,
  error,
  data,
  isEmpty,
  onRetry,
  loading,
  empty,
  children,
}: QueryStateProps<T>) {
  if (isLoading) {
    return (
      <>
        {loading ?? (
          <div className="space-y-2" role="status" aria-label="Carregando">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
            <Skeleton className="h-8 w-4/6" />
          </div>
        )}
      </>
    );
  }

  if (isError) {
    if (isPermissionError(error)) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
          <div className="space-y-1">
            <div className="font-medium">Sem acesso a estes dados</div>
            <p className="text-sm text-muted-foreground max-w-md break-words">
              Você não é membro desta obra ou não tem permissão no setor necessário. Fale com um GM
              para receber acesso.
            </p>
          </div>
        </div>
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Não foi possível carregar.";
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <div className="space-y-1">
          <div className="font-medium">Não foi possível carregar</div>
          <p className="text-sm text-muted-foreground max-w-md break-words">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <Loader2 className="h-4 w-4 mr-1" />
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (data === undefined || data === null) {
    return <>{empty ?? null}</>;
  }
  if (isEmpty && isEmpty(data) && empty !== undefined) {
    return <>{empty}</>;
  }
  return <>{children(data)}</>;
}

/**
 * Detecta erros de RLS/permissão do PostgREST para exibir mensagem amigável
 * em vez do erro técnico ("permission denied", "row-level security", 42501).
 */
export function isPermissionError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { code?: string; status?: number; message?: string };
  if (anyErr.code === "42501" || anyErr.code === "PGRST301" || anyErr.code === "PGRST302")
    return true;
  if (anyErr.status === 401 || anyErr.status === 403) return true;
  const msg = (anyErr.message ?? String(err)).toLowerCase();
  return (
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("not authorized")
  );
}
